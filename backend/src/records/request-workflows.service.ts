import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';
import { ProjectMaterialPlanService } from './project-material-plan.service';

type Decision = 'approve' | 'reject' | 'return' | 'fulfill' | 'cancel';

@Injectable()
export class RequestWorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  async listReservations(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    const rows = await this.prisma.stockReservation.findMany({
      where: { organizationId: ctx.orgId!, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      ...row,
      qty: row.qty.toNumber(),
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString(),
    }));
  }

  async decide(user: AuthUser, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    const decision = String(body.decision || '') as Decision;
    if (
      !['approve', 'reject', 'return', 'fulfill', 'cancel'].includes(decision)
    )
      throw new BadRequestException('Sorğu qərarı düzgün deyil');
    if (
      decision === 'approve' ||
      decision === 'reject' ||
      decision === 'return' ||
      decision === 'cancel'
    ) {
      if (ctx.seat !== 'direktor')
        throw new ForbiddenException(
          'Sorğular üzrə qərarı yalnız şirkət rəhbəri verə bilər',
        );
    } else if (
      !['direktor', 'anbardar', 'satinalma'].includes(ctx.seat || '') &&
      !['director', 'warehouse', 'procurement'].includes(user.role)
    ) {
      throw new ForbiddenException(
        'Anbar sorğusunu yalnız rəhbər və anbar səlahiyyətlisi icra edə bilər',
      );
    }

    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map((id) => String(id).trim()).filter(Boolean))]
      : [];
    const reason = String(body.reason || '').trim();
    const key = String(body.key || '');
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(key))
      throw new BadRequestException('Əməliyyat açarı düzgün deyil');
    if (!ids.length || ids.length > 100)
      throw new BadRequestException('1–100 sorğu seçin');
    if (
      (decision === 'reject' ||
        decision === 'return' ||
        decision === 'cancel') &&
      !reason
    )
      throw new BadRequestException('Qərarın səbəbini yazın');

    const results: {
      id: string;
      ok: boolean;
      message: string;
      replayed?: boolean;
    }[] = [];
    for (const id of ids) {
      const rowKey = `${key}_${createHash('sha256').update(id).digest('hex').slice(0, 12)}`;
      const hash = createHash('sha256')
        .update(
          JSON.stringify({
            id,
            decision,
            reason,
            qty:
              body.qtyById && typeof body.qtyById === 'object'
                ? (body.qtyById as Record<string, unknown>)[id]
                : undefined,
            edit: (body.editsById as Record<string, unknown> | undefined)?.[id],
            allocation: (
              body.allocationsById as Record<string, unknown> | undefined
            )?.[id],
          }),
        )
        .digest('hex');
      try {
        const result = await serializable(
          this.prisma,
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId || ''}))`;
            const replay = await tx.operationReceipt.findUnique({
              where: {
                organizationId_key: { organizationId: ctx.orgId!, key: rowKey },
              },
            });
            if (replay) {
              if (
                replay.requestHash !== hash ||
                replay.accountId !== ctx.accountId
              )
                throw new ConflictException(
                  'Əməliyyat açarı fərqli sorğuya aiddir',
                );
              return { replayed: true };
            }
            const request = await tx.materialRequest.findFirst({
              where: { id, organizationId: ctx.orgId! },
            });
            if (!request) throw new NotFoundException('Tələbnamə tapılmadı');
            let nextStatus = request.status;
            let details: Record<string, unknown> = {};
            const now = new Date().toISOString();

            if (decision === 'approve') {
              if (request.status !== 'gozleyir' && request.status !== 'teklif')
                throw new ConflictException(
                  'Yalnız açıq tələbnamə təsdiqlənir',
                );
              const qtyValue =
                body.qtyById && typeof body.qtyById === 'object'
                  ? (body.qtyById as Record<string, unknown>)[id]
                  : undefined;
              if (
                qtyValue !== undefined &&
                !/^\d{1,11}(?:\.\d{1,3})?$/.test(String(qtyValue))
              )
                throw new BadRequestException(
                  'Təsdiq miqdarını maksimum 3 onluq rəqəmlə daxil edin',
                );
              const qty =
                qtyValue === undefined
                  ? request.qty
                  : new Prisma.Decimal(String(qtyValue));
              if (!qty.greaterThan(0))
                throw new BadRequestException(
                  'Təsdiq miqdarı sıfırdan böyük olmalıdır',
                );
              const edit =
                (
                  body.editsById as
                    Record<string, Record<string, unknown>> | undefined
                )?.[id] || {};
              if (
                edit.expectedUpdatedAt &&
                String(edit.expectedUpdatedAt) !==
                  request.updatedAt.toISOString()
              )
                throw new ConflictException(
                  'Tələbnamə dəyişib; paneli yeniləyin',
                );
              const materialId =
                edit.materialId === undefined
                  ? request.materialId
                  : String(edit.materialId);
              const [material, project] = await Promise.all([
                tx.material.findFirst({
                  where: { id: materialId, organizationId: ctx.orgId! },
                }),
                tx.project.findFirst({
                  where: { id: request.projectId, organizationId: ctx.orgId! },
                }),
              ]);
              if (!material || !project)
                throw new BadRequestException(
                  'Layihə və ya material bu şirkətə aid deyil',
                );
              if (project.status === 'tehvil')
                throw new ConflictException(
                  'Təhvil verilmiş layihəyə açıq tələb təsdiqlənmir',
                );
              if (
                edit.materialId === undefined &&
                material.unit !== request.unit
              )
                throw new BadRequestException(
                  'Material vahidi tələbnamə ilə uyğun deyil',
                );
              const text =
                edit.text === undefined
                  ? request.text
                  : String(edit.text).trim();
              const priority =
                edit.priority === undefined
                  ? request.priority
                  : String(edit.priority);
              const requiredOn =
                edit.requiredOn === undefined
                  ? request.requiredOn
                  : edit.requiredOn
                    ? String(edit.requiredOn)
                    : null;
              if (
                !['normal', 'urgent', 'critical'].includes(priority) ||
                String(text || '').length > 1000 ||
                (requiredOn &&
                  (!/^\d{4}-\d{2}-\d{2}$/.test(requiredOn) ||
                    Number.isNaN(Date.parse(requiredOn)) ||
                    new Date(requiredOn).toISOString().slice(0, 10) !==
                      requiredOn))
              )
                throw new BadRequestException(
                  'Təcililik, tarix və ya qeyd düzgün deyil',
                );
              const allocation = (
                body.allocationsById as Record<string, unknown> | undefined
              )?.[id];
              const reservedQty = await this.reserveAvailable(
                tx,
                ctx.orgId!,
                id,
                materialId,
                qty,
                user.name,
                request.projectId,
                allocation,
              );
              await tx.materialRequest.update({
                where: { id },
                data: {
                  materialId,
                  material: material.name,
                  unit: material.unit,
                  text,
                  priority,
                  requiredOn,
                },
              });
              const uncoveredQty = qty.minus(reservedQty);
              const decisionText = `Rəhbər təsdiqlədi · ${reservedQty.toString()} ${material.unit} rezerv edildi · ${uncoveredQty.toString()} ${material.unit} təminat gözləyir${reason ? ` · ${reason}` : ''}`;
              await tx.materialRequest.update({
                where: { id },
                data: {
                  qty,
                  fulfilledQty: 0,
                  status: 'tesdiq',
                  decidedBy: user.name,
                  decision: decisionText,
                },
              });
              nextStatus = 'tesdiq';
              details = {
                before: {
                  materialId: request.materialId,
                  qty: request.qty.toString(),
                  unit: request.unit,
                  text: request.text,
                  priority: request.priority,
                  requiredOn: request.requiredOn,
                },
                after: {
                  materialId,
                  qty: qty.toString(),
                  unit: material.unit,
                  text,
                  priority,
                  requiredOn,
                },
                reservedQty: reservedQty.toString(),
                uncoveredQty: uncoveredQty.toString(),
                allocation: allocation ?? 'automatic',
              };
            } else if (decision === 'reject' || decision === 'return') {
              if (request.status !== 'gozleyir' && request.status !== 'teklif')
                throw new ConflictException(
                  'Yalnız açıq tələbnaməyə qərar verilir',
                );
              nextStatus = decision === 'reject' ? 'redd' : 'qaytarildi';
              await tx.materialRequest.update({
                where: { id },
                data: {
                  status: nextStatus,
                  decidedBy: user.name,
                  decision: reason,
                },
              });
              details = { reason };
            } else if (decision === 'cancel') {
              if (request.status !== 'tesdiq')
                throw new ConflictException(
                  'Yalnız təsdiqlənmiş sorğunun rezervi ləğv edilə bilər',
                );
              if (request.fulfilledQty.greaterThan(0))
                throw new ConflictException(
                  'Qismən köçürülmüş sorğu ləğv edilmir; əvvəl stok hərəkətini düzəlişlə həll edin',
                );
              const released = await tx.stockReservation.updateMany({
                where: {
                  organizationId: ctx.orgId!,
                  requestId: id,
                  status: 'active',
                },
                data: {
                  status: 'released',
                  resolvedAt: new Date(now),
                  resolvedBy: user.name,
                },
              });
              nextStatus = 'redd';
              await tx.materialRequest.update({
                where: { id },
                data: {
                  status: 'redd',
                  decidedBy: user.name,
                  decision: `Təsdiq ləğv edildi · ${reason}`,
                },
              });
              details = { reason, releasedReservations: released.count };
            } else {
              if (request.status !== 'tesdiq')
                throw new ConflictException(
                  'Yalnız rəhbər təsdiqli tələbnamə anbardan verilir',
                );
              const destination = await tx.location.findFirst({
                where: {
                  organizationId: ctx.orgId!,
                  projectId: request.projectId,
                },
              });
              if (!destination)
                throw new BadRequestException(
                  'Layihə üçün sahə anbarı tapılmadı',
                );
              const material = await tx.material.findFirst({
                where: { id: request.materialId, organizationId: ctx.orgId! },
              });
              if (!material) throw new NotFoundException('Material tapılmadı');
              const activeBefore = await tx.stockReservation.findMany({
                where: {
                  organizationId: ctx.orgId!,
                  requestId: id,
                  status: 'active',
                },
              });
              const alreadyReserved = activeBefore.reduce(
                (sum, item) => sum.plus(item.qty),
                new Prisma.Decimal(0),
              );
              const need = Prisma.Decimal.max(
                0,
                request.qty.minus(request.fulfilledQty).minus(alreadyReserved),
              );
              if (need.greaterThan(0))
                await this.reserveAvailable(
                  tx,
                  ctx.orgId!,
                  id,
                  request.materialId,
                  need,
                  user.name,
                );
              const active = await tx.stockReservation.findMany({
                where: {
                  organizationId: ctx.orgId!,
                  requestId: id,
                  status: 'active',
                },
                orderBy: { createdAt: 'asc' },
              });
              if (!active.length)
                throw new BadRequestException(
                  'Rezervsiz sərbəst stok yoxdur; təminat gözlənilir',
                );
              let moved = new Prisma.Decimal(0);
              for (const reservation of active) {
                const stock = await tx.stock.findFirst({
                  where: {
                    organizationId: ctx.orgId!,
                    materialId: request.materialId,
                    locationId: reservation.locationId,
                  },
                });
                if (!stock || stock.qty.lessThan(reservation.qty))
                  throw new ConflictException(
                    'Rezerv mənbəyində fiziki qalıq çatmır; uzlaşdırma tələb olunur',
                  );
                await tx.stock.update({
                  where: { id: stock.id },
                  data: { qty: { decrement: reservation.qty } },
                });
                await tx.stock.upsert({
                  where: {
                    materialId_locationId: {
                      materialId: request.materialId,
                      locationId: destination.id,
                    },
                  },
                  update: { qty: { increment: reservation.qty } },
                  create: {
                    organizationId: ctx.orgId!,
                    materialId: request.materialId,
                    locationId: destination.id,
                    qty: reservation.qty,
                  },
                });
                await tx.movement.create({
                  data: {
                    organizationId: ctx.orgId!,
                    materialId: material.id,
                    material: material.name,
                    type: 'transfer',
                    qty: reservation.qty,
                    unit: request.unit,
                    project: request.project,
                    locationId: destination.id,
                    from: reservation.locationId,
                    date: now.slice(0, 10),
                    by: user.name,
                    note: `Tələb ${request.id}`,
                  },
                });
                await tx.stockReservation.update({
                  where: { id: reservation.id },
                  data: {
                    status: 'consumed',
                    resolvedAt: new Date(now),
                    resolvedBy: user.name,
                  },
                });
                moved = moved.plus(reservation.qty);
              }
              const fulfilledQty = request.fulfilledQty.plus(moved);
              const complete = fulfilledQty.greaterThanOrEqualTo(request.qty);
              await tx.materialRequest.update({
                where: { id },
                data: {
                  fulfilledQty,
                  status: complete ? 'anbar' : 'tesdiq',
                  decidedBy: user.name,
                  decision: `${fulfilledQty.toString()} / ${request.qty.toString()} ${request.unit} sahəyə köçürüldü${complete ? '' : ' · qalıq üçün əlavə sərbəst stok gözlənilir'}`,
                },
              });
              nextStatus = complete ? 'anbar' : 'tesdiq';
              details = {
                movedQty: moved.toString(),
                fulfilledQty: fulfilledQty.toString(),
                requestedQty: request.qty.toString(),
                locationId: destination.id,
              };
            }

            await tx.auditEntry.create({
              data: {
                organizationId: ctx.orgId!,
                at: now,
                actor: user.name,
                role: user.role,
                action: `Material sorğusu: ${decision}`,
                detail: JSON.stringify({
                  id,
                  before: request.status,
                  after: nextStatus,
                  ...details,
                }),
              },
            });
            await tx.operationReceipt.create({
              data: {
                organizationId: ctx.orgId!,
                accountId: ctx.accountId,
                key: rowKey,
                requestHash: hash,
                command: `request-${decision}`,
                changedBooks: {
                  requestId: id,
                  status: nextStatus,
                  ...details,
                } as Prisma.InputJsonValue,
              },
            });
            return { replayed: false, details };
          },
          60000,
        );
        const resultDetails =
          'details' in result
            ? (result as { details?: Record<string, unknown> }).details
            : undefined;
        results.push({
          id,
          ok: true,
          message: result.replayed
            ? 'Əvvəlki əməliyyat təkrar tanındı'
            : decision === 'approve' && resultDetails
              ? `Rezerv: ${resultDetails.reservedQty} · təminat gözləyən: ${resultDetails.uncoveredQty}`
              : decision === 'fulfill' && resultDetails
                ? `Köçürüldü: ${resultDetails.movedQty} · ümumi: ${resultDetails.fulfilledQty}/${resultDetails.requestedQty}`
                : 'Qərar qeydə alındı',
          replayed: result.replayed,
        });
      } catch (error) {
        const response =
          error instanceof HttpException ? error.getResponse() : null;
        const message =
          typeof response === 'string'
            ? response
            : response && typeof response === 'object' && 'message' in response
              ? String((response as { message: unknown }).message)
              : error instanceof Error
                ? error.message
                : 'Əməliyyat alınmadı';
        results.push({ id, ok: false, message });
      }
    }
    return {
      results,
      succeeded: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
    };
  }

  private async availability(
    tx: Prisma.TransactionClient,
    organizationId: string,
    materialId: string,
  ) {
    const [locations, stocks, reservations, transfers, custody, returns] =
      await Promise.all([
        tx.location.findMany({ where: { organizationId } }),
        tx.stock.findMany({ where: { organizationId, materialId } }),
        tx.stockReservation.findMany({
          where: { organizationId, materialId, status: 'active' },
        }),
        tx.shipmentLine.findMany({
          where: {
            materialId,
            shipment: {
              organizationId,
              status: { in: ['waiting_sender', 'sent'] },
            },
          },
          include: { shipment: { select: { fromLocationId: true } } },
        }),
        tx.materialHandover.findMany({
          where: {
            organizationId,
            materialId,
            status: { in: ['waiting_custodian', 'accepted'] },
          },
        }),
        tx.supplierGoodsReturnLine.findMany({
          where: {
            materialId,
            goodsReturn: {
              organizationId,
              status: { in: ['draft', 'approved'] },
            },
          },
          include: { goodsReturn: { select: { locationId: true } } },
        }),
      ]);
    const sum = (a: Prisma.Decimal[]) =>
      a.reduce((n, v) => n.plus(v), new Prisma.Decimal(0));
    return locations.map((l) => {
      const physical = sum(
          stocks.filter((s) => s.locationId === l.id).map((s) => s.qty),
        ),
        reserved = sum(
          reservations.filter((r) => r.locationId === l.id).map((r) => r.qty),
        ),
        transferHeld = sum(
          transfers
            .filter((r) => r.shipment.fromLocationId === l.id)
            .map((r) => r.qty),
        ),
        custodyHeld = sum(
          custody
            .filter((r) => r.locationId === l.id)
            .map((r) => (r.status === 'accepted' ? r.remainingQty : r.qty)),
        ),
        returnHeld = sum(
          returns
            .filter((r) => r.goodsReturn.locationId === l.id)
            .map((r) => r.qty),
        );
      return {
        locationId: l.id,
        locationName: l.name,
        projectId: l.projectId,
        physical,
        reserved,
        transferHeld,
        custodyHeld,
        returnHeld,
        free: Prisma.Decimal.max(
          0,
          physical
            .minus(reserved)
            .minus(transferHeld)
            .minus(custodyHeld)
            .minus(returnHeld),
        ),
      };
    });
  }
  private async reserveAvailable(
    tx: Prisma.TransactionClient,
    organizationId: string,
    requestId: string,
    materialId: string,
    amount: Prisma.Decimal,
    createdBy: string,
    projectId?: string,
    allocation?: unknown,
  ) {
    const candidates = (await this.availability(tx, organizationId, materialId))
      .filter((l) => !l.projectId || (projectId && l.projectId === projectId))
      .sort((a, b) => b.free.comparedTo(a.free));
    let remaining = amount,
      reserved = new Prisma.Decimal(0);
    if (allocation !== undefined) {
      if (!Array.isArray(allocation) || allocation.length > 100)
        throw new BadRequestException('Anbar bölgüsü düzgün deyil');
      const seen = new Set<string>();
      for (const row of allocation) {
        if (
          !row ||
          typeof row !== 'object' ||
          !/^\d{1,11}(?:\.\d{1,3})?$/.test(String(row.qty))
        )
          throw new BadRequestException('Bölgü miqdarı düzgün deyil');
        const locationId = String(row.locationId || ''),
          qty = new Prisma.Decimal(String(row.qty));
        if (seen.has(locationId) || !qty.gt(0))
          throw new BadRequestException(
            'Bölgü sətri təkrarlanır və ya sıfırdır',
          );
        seen.add(locationId);
        const c = candidates.find((c) => c.locationId === locationId);
        if (!c)
          throw new BadRequestException(
            'Başqa layihə anbarı üçün ayrıca təsdiqli transfer tələb olunur',
          );
        if (qty.gt(c.free) || qty.gt(remaining))
          throw new ConflictException(
            'Seçilmiş anbar bölgüsü sərbəst qalıq və ya tələb miqdarını aşır',
          );
        await tx.stockReservation.create({
          data: {
            organizationId,
            requestId,
            materialId,
            locationId,
            qty,
            status: 'active',
            createdBy,
          },
        });
        remaining = remaining.minus(qty);
        reserved = reserved.plus(qty);
      }
      return reserved;
    }
    for (const c of candidates) {
      if (!remaining.gt(0)) break;
      const qty = Prisma.Decimal.min(c.free, remaining);
      if (!qty.gt(0)) continue;
      await tx.stockReservation.create({
        data: {
          organizationId,
          requestId,
          materialId,
          locationId: c.locationId,
          qty,
          status: 'active',
          createdBy,
        },
      });
      remaining = remaining.minus(qty);
      reserved = reserved.plus(qty);
    }
    return reserved;
  }
  async board(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    if (ctx.seat !== 'direktor')
      throw new ForbiddenException('Rəhbər paneli yalnız direktor üçündür');
    const organizationId = this.tenant.requireOrg(ctx);
    const snapshot = await serializable(this.prisma, async (tx) => {
      const [requests, projects, materials, purchases, incoming] =
        await Promise.all([
          tx.materialRequest.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 500,
          }),
          tx.project.findMany({
            where: { organizationId },
            select: { id: true, name: true, status: true },
          }),
          tx.material.findMany({
            where: { organizationId },
            select: { id: true, name: true, unit: true },
          }),
          tx.purchaseActLine.findMany({
            where: {
              act: { organizationId, status: { in: ['qaralama', 'qismən'] } },
            },
            include: { act: { select: { projectId: true } } },
          }),
          tx.shipmentLine.findMany({
            where: {
              shipment: {
                organizationId,
                status: { in: ['waiting_sender', 'sent'] },
              },
            },
            include: { shipment: { include: { toLocation: true } } },
          }),
        ]);
      const activeReservations = await tx.stockReservation.findMany({
        where: { organizationId, status: 'active' },
      });
      const availability: Record<string, unknown> = {};
      for (const m of materials)
        availability[m.id] = (
          await this.availability(tx, organizationId, m.id)
        ).map((l) => ({
          ...l,
          physical: l.physical.toString(),
          reserved: l.reserved.toString(),
          transferHeld: l.transferHeld.toString(),
          custodyHeld: l.custodyHeld.toString(),
          returnHeld: l.returnHeld.toString(),
          free: l.free.toString(),
        }));
      return {
        requests: requests.map((r) => ({
          ...r,
          qty: r.qty.toString(),
          allocations: activeReservations
            .filter((a) => a.requestId === r.id)
            .map((a) => ({ locationId: a.locationId, qty: a.qty.toString() })),
          reservedQty: activeReservations
            .filter((a) => a.requestId === r.id)
            .reduce((n, a) => n.plus(a.qty), new Prisma.Decimal(0))
            .toString(),
          fulfilledQty: r.fulfilledQty.toString(),
          updatedAt: r.updatedAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
          expectedIncoming: purchases
            .filter(
              (l) =>
                l.materialId === r.materialId &&
                l.act.projectId === r.projectId,
            )
            .reduce(
              (n, l) =>
                n.plus(
                  Prisma.Decimal.max(
                    0,
                    l.qty.minus(l.receivedQty).minus(l.closedQty),
                  ),
                ),
              new Prisma.Decimal(0),
            )
            .plus(
              incoming
                .filter(
                  (l) =>
                    l.materialId === r.materialId &&
                    l.shipment.toLocation?.projectId === r.projectId,
                )
                .reduce((n, l) => n.plus(l.qty), new Prisma.Decimal(0)),
            )
            .toString(),
        })),
        projects,
        materials,
        availability,
      };
    });
    const plans: Record<string, unknown> = {};
    const service = new ProjectMaterialPlanService(this.prisma, this.tenant);
    for (const project of snapshot.projects) {
      const report = await service.report(user, project.id);
      plans[project.id] = {
        approved: !!report.plan,
        sourceChanged: report.sourceChanged,
        items: report.items.map((i) => ({
          materialId: i.materialId,
          remaining: i.remaining,
          planned: i.planned,
        })),
      };
    }
    return {
      ...snapshot,
      plans,
      generatedAt: new Date().toISOString(),
      limit: 500,
    };
  }
}
