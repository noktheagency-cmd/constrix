import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';
type CountLine = {
  materialId: string;
  name: string;
  unit: string;
  expected: string;
  counted: string;
  materialQty: string;
  lots: { id: string; qty: string }[];
};
@Injectable()
export class WarehouseControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}
  private async context(user: AuthUser, director = false) {
    const c = await this.tenant.load(user);
    this.tenant.allow(c, 'warehouse');
    if (
      !(director ? ['direktor'] : ['direktor', 'anbardar']).includes(
        c.seat || '',
      )
    )
      throw new ForbiddenException(
        'Anbar məsulu və ya direktor səlahiyyəti tələb olunur',
      );
    return { ...c, org: this.tenant.requireOrg(c) };
  }
  async overview(user: AuthUser) {
    const c = await this.context(user);
    const [locations, members, counts, materials, projects] = await Promise.all(
      [
        this.prisma.location.findMany({
          where: { organizationId: c.org },
          orderBy: { name: 'asc' },
        }),
        this.prisma.organizationMember.findMany({
          where: {
            organizationId: c.org,
            accountId: { not: null },
            seatRole: { in: ['direktor', 'anbardar'] },
          },
          select: { accountId: true, name: true },
        }),
        this.prisma.warehouseCount.findMany({
          where: { organizationId: c.org },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        this.prisma.material.findMany({
          where: { organizationId: c.org },
          select: { id: true, name: true, unit: true },
        }),
        this.prisma.project.findMany({
          where: { organizationId: c.org },
          select: { id: true, name: true },
        }),
      ],
    );
    return { locations, members, counts, materials, projects };
  }
  async location(user: AuthUser, body: Record<string, unknown>) {
    const c = await this.context(user, true);
    const id = String(body.id || ''),
      name = String(body.name || '').trim(),
      kind = String(body.kind || ''),
      parentId = body.parentId ? String(body.parentId) : null,
      responsibleAccountId = String(body.responsibleAccountId || '');
    if (
      !name ||
      name.length > 160 ||
      !['merkez', 'layihe', 'sahe', 'muveqqeti', 'zavod', 'sex'].includes(kind)
    )
      throw new BadRequestException('Anbar adı və növü düzgün deyil');
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.org}))`;
      const rows = await tx.location.findMany({
        where: { organizationId: c.org },
      });
      if (id && !rows.some((r) => r.id === id))
        throw new NotFoundException('Anbar tapılmadı');
      let cursor = parentId;
      const seen = new Set([id]);
      while (cursor) {
        if (seen.has(cursor))
          throw new ConflictException(
            'Anbar iyerarxiyasında dövr yarana bilməz',
          );
        seen.add(cursor);
        const p = rows.find((r) => r.id === cursor);
        if (!p) throw new BadRequestException('Üst anbar bu şirkətə aid deyil');
        cursor = p.parentId;
      }
      const member = await tx.organizationMember.findFirst({
        where: {
          organizationId: c.org,
          accountId: responsibleAccountId,
          seatRole: { in: ['direktor', 'anbardar'] },
        },
      });
      if (!member)
        throw new BadRequestException('Şirkətin anbar məsulunu seçin');
      const existing = rows.find((r) => r.id === id);
      const parent = rows.find((r) => r.id === parentId);
      const projectId = body.projectId
        ? String(body.projectId)
        : existing?.projectId || parent?.projectId || null;
      if (parent?.projectId && projectId !== parent.projectId)
        throw new ConflictException('Üst və alt anbarın layihəsi uyğun deyil');
      if (existing && existing.projectId !== projectId)
        throw new ConflictException(
          'Mövcud anbarın layihəsi dəyişmir; yeni anbar yaradın',
        );
      if (
        projectId &&
        !(await tx.project.findFirst({
          where: { id: projectId, organizationId: c.org },
        }))
      )
        throw new BadRequestException('Layihə bu şirkətə aid deyil');
      const data = { name, kind, parentId, responsibleAccountId, projectId };
      const row = id
        ? await tx.location.update({ where: { id }, data })
        : await tx.location.create({
            data: { ...data, organizationId: c.org },
          });
      await this.audit(tx, c, user, 'warehouse-location', row.id);
      return row;
    });
  }
  async count(user: AuthUser, body: Record<string, unknown>) {
    const c = await this.context(user);
    const locationId = String(body.locationId || ''),
      reason = String(body.reason || '').trim(),
      documentRef = String(body.documentRef || '').trim();
    if (
      reason.length < 3 ||
      reason.length > 500 ||
      !documentRef ||
      documentRef.length > 200 ||
      !Array.isArray(body.lines) ||
      !body.lines.length ||
      body.lines.length > 200
    )
      throw new BadRequestException(
        'Sayım sətirləri, səbəb və sənəd istinadı tələb olunur',
      );
    if (body.lines.some((l) => !l || typeof l !== 'object'))
      throw new BadRequestException('Sayım sətri düzgün deyil');
    const inputs = body.lines as { materialId: string; counted: string }[];
    if (new Set(inputs.map((l) => l.materialId)).size !== inputs.length)
      throw new BadRequestException('Material təkrarlanır');
    return serializable(this.prisma, async (tx) => {
      const loc = await tx.location.findFirst({
        where: { id: locationId, organizationId: c.org },
      });
      if (!loc) throw new NotFoundException('Anbar tapılmadı');
      if (c.seat !== 'direktor' && loc.responsibleAccountId !== c.accountId)
        throw new ForbiddenException(
          'Bu anbarın təyin edilmiş məsulu sayımı göndərməlidir',
        );
      const lines: CountLine[] = [];
      for (const input of inputs) {
        if (!/^\d{1,10}(\.\d{1,3})?$/.test(String(input.counted)))
          throw new BadRequestException(
            'Sayılmış miqdar mənfi ola bilməz, dəqiqlik 0.001-dir',
          );
        const m = await tx.material.findFirst({
          where: { id: String(input.materialId), organizationId: c.org },
        });
        if (!m) throw new BadRequestException('Material bu şirkətə aid deyil');
        const stock = await tx.stock.findFirst({
          where: { organizationId: c.org, materialId: m.id, locationId },
        });
        const lots = await tx.stockLot.findMany({
          where: {
            organizationId: c.org,
            materialId: m.id,
            locationId,
            qty: { gt: 0 },
          },
          orderBy: { id: 'asc' },
        });
        lines.push({
          materialId: m.id,
          name: m.name,
          unit: m.unit,
          expected: stock?.qty.toString() || '0',
          counted: String(input.counted),
          materialQty: m.qty.toString(),
          lots: lots.map((l) => ({ id: l.id, qty: l.qty.toString() })),
        });
      }
      const row = await tx.warehouseCount.create({
        data: {
          organizationId: c.org,
          locationId,
          reason,
          documentRef,
          lines: lines as unknown as Prisma.InputJsonValue,
          createdById: c.accountId,
          createdBy: user.name,
        },
      });
      await this.audit(tx, c, user, 'warehouse-count-submit', row.id);
      return row;
    });
  }
  async review(user: AuthUser, id: string, body: Record<string, unknown>) {
    const c = await this.context(user, true);
    const decision = String(body.decision || ''),
      note = String(body.note || '').trim();
    if (
      !['approve', 'reject'].includes(decision) ||
      note.length < 3 ||
      note.length > 500
    )
      throw new BadRequestException('Qərar və əsas tələb olunur');
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.org}))`;
      const doc = await tx.warehouseCount.findFirst({
        where: { id, organizationId: c.org },
      });
      if (!doc) throw new NotFoundException('Sayım tapılmadı');
      const status = decision === 'approve' ? 'approved' : 'rejected';
      if (
        doc.status === status &&
        doc.reviewedById === c.accountId &&
        doc.reviewNote === note
      )
        return doc;
      if (doc.status !== 'pending')
        throw new ConflictException('Sayım artıq bağlanıb');
      if (doc.createdById === c.accountId)
        throw new ConflictException('Sayımı başqa direktor təsdiqləməlidir');
      if (decision === 'approve') {
        for (const line of doc.lines as unknown as CountLine[]) {
          const m = await tx.material.findFirst({
            where: { id: line.materialId, organizationId: c.org },
          });
          const stock = await tx.stock.findFirst({
            where: {
              organizationId: c.org,
              materialId: line.materialId,
              locationId: doc.locationId,
            },
          });
          const lots = await tx.stockLot.findMany({
            where: {
              organizationId: c.org,
              materialId: line.materialId,
              locationId: doc.locationId,
              qty: { gt: 0 },
            },
            orderBy: { id: 'asc' },
          });
          const snapshot = lots.map((l) => ({
            id: l.id,
            qty: l.qty.toString(),
          }));
          const total = await tx.stock.aggregate({
            where: { organizationId: c.org, materialId: line.materialId },
            _sum: { qty: true },
          });
          if (
            !m ||
            m.qty.toString() !== line.materialQty ||
            (stock?.qty.toString() || '0') !== line.expected ||
            JSON.stringify(snapshot) !== JSON.stringify(line.lots)
          )
            throw new ConflictException(
              'Sayım göndərildikdən sonra stok dəyişib; yenidən sayım göndərin',
            );
          const expected = new Prisma.Decimal(line.expected),
            counted = new Prisma.Decimal(line.counted),
            delta = counted.minus(expected);
          if (
            !lots
              .reduce((n, l) => n.plus(l.qty), new Prisma.Decimal(0))
              .eq(expected) ||
            !m.qty.eq(total._sum.qty || 0)
          )
            throw new ConflictException(
              'Əvvəl mövcud Stock/lot/material fərqini sənədli uzlaşdırın',
            );
          if (delta.isZero()) continue;
          const [reservations, shipments, custody, returns] = await Promise.all(
            [
              tx.stockReservation.count({
                where: {
                  organizationId: c.org,
                  materialId: m.id,
                  locationId: doc.locationId,
                  status: 'active',
                },
              }),
              tx.shipmentLine.count({
                where: {
                  materialId: m.id,
                  shipment: {
                    organizationId: c.org,
                    fromLocationId: doc.locationId,
                    status: { in: ['waiting_sender', 'sent'] },
                  },
                },
              }),
              tx.materialHandover.count({
                where: {
                  organizationId: c.org,
                  materialId: m.id,
                  locationId: doc.locationId,
                  status: { in: ['waiting_custodian', 'accepted'] },
                },
              }),
              tx.supplierGoodsReturnLine.count({
                where: {
                  materialId: m.id,
                  goodsReturn: {
                    organizationId: c.org,
                    locationId: doc.locationId,
                    status: { in: ['draft', 'approved'] },
                  },
                },
              }),
            ],
          );
          if (reservations || shipments || custody || returns)
            throw new ConflictException(
              'Aktiv rezerv, transfer, məsul balansı və ya qaytarma var; əvvəl sənədləri bağlayın',
            );
          if (delta.gt(0))
            await tx.stockLot.create({
              data: {
                organizationId: c.org,
                materialId: m.id,
                locationId: doc.locationId,
                code: m.id,
                qty: delta,
                unitCost: m.price,
                qr: `COUNT:${id}:${m.id}`,
                batch: `Sayım ${id}`,
              },
            });
          else {
            let remaining = delta.negated();
            for (const lot of lots) {
              const used = Prisma.Decimal.min(remaining, lot.qty);
              await tx.stockLot.update({
                where: { id: lot.id },
                data: { qty: { decrement: used } },
              });
              remaining = remaining.minus(used);
              if (remaining.isZero()) break;
            }
          }
          await tx.stock.upsert({
            where: {
              materialId_locationId: {
                materialId: m.id,
                locationId: doc.locationId,
              },
            },
            create: {
              organizationId: c.org,
              materialId: m.id,
              locationId: doc.locationId,
              qty: counted,
            },
            update: { qty: counted },
          });
          await tx.material.update({
            where: { id: m.id },
            data: { qty: { increment: delta } },
          });
          await tx.movement.create({
            data: {
              organizationId: c.org,
              materialId: m.id,
              material: m.name,
              locationId: doc.locationId,
              type: delta.gt(0) ? 'medaxil' : 'mexaric',
              qty: delta.abs(),
              unit: m.unit,
              project: '',
              date: new Date().toISOString().slice(0, 10),
              by: user.name,
              from: `COUNT:${id}`,
              note: `${doc.documentRef}: ${doc.reason}`,
            },
          });
        }
      }
      const row = await tx.warehouseCount.update({
        where: { id },
        data: {
          status,
          reviewedById: c.accountId,
          reviewedBy: user.name,
          reviewNote: note,
          reviewedAt: new Date(),
        },
      });
      await this.audit(tx, c, user, `warehouse-count-${decision}`, id);
      return row;
    });
  }
  private async audit(
    tx: Prisma.TransactionClient,
    c: { org: string },
    user: AuthUser,
    action: string,
    id: string,
  ) {
    await tx.auditEntry.create({
      data: {
        organizationId: c.org,
        at: new Date().toISOString(),
        actor: user.name,
        role: user.role,
        action,
        detail: id,
      },
    });
  }
}
