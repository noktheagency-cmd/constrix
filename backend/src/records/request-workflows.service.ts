import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';

type Decision = 'approve' | 'reject' | 'return' | 'fulfill' | 'cancel';

@Injectable()
export class RequestWorkflowsService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantService) {}

  async listReservations(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    const rows = await this.prisma.stockReservation.findMany({ where: { organizationId: ctx.orgId!, status: 'active' }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({ ...row, qty: row.qty.toNumber(), createdAt: row.createdAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() }));
  }

  async decide(user: AuthUser, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    const decision = String(body.decision || '') as Decision;
    if (!['approve', 'reject', 'return', 'fulfill', 'cancel'].includes(decision)) throw new BadRequestException('Sorğu qərarı düzgün deyil');
    if (decision === 'approve' || decision === 'reject' || decision === 'return' || decision === 'cancel') {
      if (ctx.seat !== 'direktor') throw new ForbiddenException('Sorğular üzrə qərarı yalnız şirkət rəhbəri verə bilər');
    } else if (!['direktor', 'anbardar', 'satinalma'].includes(ctx.seat || '') && !['director', 'warehouse', 'procurement'].includes(user.role)) {
      throw new ForbiddenException('Anbar sorğusunu yalnız rəhbər və anbar səlahiyyətlisi icra edə bilər');
    }

    const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map((id) => String(id).trim()).filter(Boolean))] : [];
    const reason = String(body.reason || '').trim();
    const key = String(body.key || '');
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(key)) throw new BadRequestException('Əməliyyat açarı düzgün deyil');
    if (!ids.length || ids.length > 100) throw new BadRequestException('1–100 sorğu seçin');
    if ((decision === 'reject' || decision === 'return' || decision === 'cancel') && !reason) throw new BadRequestException('Qərarın səbəbini yazın');

    const results: { id: string; ok: boolean; message: string; replayed?: boolean }[] = [];
    for (const id of ids) {
      const rowKey = `${key}_${createHash('sha256').update(id).digest('hex').slice(0, 12)}`;
      const hash = createHash('sha256').update(JSON.stringify({ id, decision, reason, qty: body.qtyById && typeof body.qtyById === 'object' ? (body.qtyById as Record<string, unknown>)[id] : undefined })).digest('hex');
      try {
        const result = await serializable(this.prisma, async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId || ''}))`;
          const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId: ctx.orgId!, key: rowKey } } });
          if (replay) {
            if (replay.requestHash !== hash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı fərqli sorğuya aiddir');
            return { replayed: true };
          }
          const request = await tx.materialRequest.findFirst({ where: { id, organizationId: ctx.orgId! } });
          if (!request) throw new NotFoundException('Tələbnamə tapılmadı');
          let nextStatus = request.status;
          let details: Record<string, unknown> = {};
          const now = new Date().toISOString();

          if (decision === 'approve') {
            if (request.status !== 'gozleyir' && request.status !== 'teklif') throw new ConflictException('Yalnız açıq tələbnamə təsdiqlənir');
            const qtyValue = body.qtyById && typeof body.qtyById === 'object' ? (body.qtyById as Record<string, unknown>)[id] : undefined;
            if (qtyValue !== undefined && !/^\d{1,11}(?:\.\d{1,3})?$/.test(String(qtyValue))) throw new BadRequestException('Təsdiq miqdarını maksimum 3 onluq rəqəmlə daxil edin');
            const qty = qtyValue === undefined ? request.qty : new Prisma.Decimal(String(qtyValue));
            if (!qty.greaterThan(0)) throw new BadRequestException('Təsdiq miqdarı sıfırdan böyük olmalıdır');
            const reservedQty = await this.reserveAvailable(tx, ctx.orgId!, id, request.materialId, qty, user.name);
            const uncoveredQty = qty.minus(reservedQty);
            const decisionText = `Rəhbər təsdiqlədi · ${reservedQty.toString()} ${request.unit} rezerv edildi · ${uncoveredQty.toString()} ${request.unit} təminat gözləyir${reason ? ` · ${reason}` : ''}`;
            await tx.materialRequest.update({ where: { id }, data: { qty, fulfilledQty: 0, status: 'tesdiq', decidedBy: user.name, decision: decisionText } });
            nextStatus = 'tesdiq'; details = { qty: qty.toString(), reservedQty: reservedQty.toString(), uncoveredQty: uncoveredQty.toString() };
          } else if (decision === 'reject' || decision === 'return') {
            if (request.status !== 'gozleyir' && request.status !== 'teklif') throw new ConflictException('Yalnız açıq tələbnaməyə qərar verilir');
            nextStatus = decision === 'reject' ? 'redd' : 'qaytarildi';
            await tx.materialRequest.update({ where: { id }, data: { status: nextStatus, decidedBy: user.name, decision: reason } });
            details = { reason };
          } else if (decision === 'cancel') {
            if (request.status !== 'tesdiq') throw new ConflictException('Yalnız təsdiqlənmiş sorğunun rezervi ləğv edilə bilər');
            if (request.fulfilledQty.greaterThan(0)) throw new ConflictException('Qismən köçürülmüş sorğu ləğv edilmir; əvvəl stok hərəkətini düzəlişlə həll edin');
            const released = await tx.stockReservation.updateMany({ where: { organizationId: ctx.orgId!, requestId: id, status: 'active' }, data: { status: 'released', resolvedAt: new Date(now), resolvedBy: user.name } });
            nextStatus = 'redd';
            await tx.materialRequest.update({ where: { id }, data: { status: 'redd', decidedBy: user.name, decision: `Təsdiq ləğv edildi · ${reason}` } });
            details = { reason, releasedReservations: released.count };
          } else {
            if (request.status !== 'tesdiq') throw new ConflictException('Yalnız rəhbər təsdiqli tələbnamə anbardan verilir');
            const destination = await tx.location.findFirst({ where: { organizationId: ctx.orgId!, projectId: request.projectId } });
            if (!destination) throw new BadRequestException('Layihə üçün sahə anbarı tapılmadı');
            const material = await tx.material.findFirst({ where: { id: request.materialId, organizationId: ctx.orgId! } });
            if (!material) throw new NotFoundException('Material tapılmadı');
            const activeBefore = await tx.stockReservation.findMany({ where: { organizationId: ctx.orgId!, requestId: id, status: 'active' } });
            const alreadyReserved = activeBefore.reduce((sum, item) => sum.plus(item.qty), new Prisma.Decimal(0));
            const need = Prisma.Decimal.max(0, request.qty.minus(request.fulfilledQty).minus(alreadyReserved));
            if (need.greaterThan(0)) await this.reserveAvailable(tx, ctx.orgId!, id, request.materialId, need, user.name);
            const active = await tx.stockReservation.findMany({ where: { organizationId: ctx.orgId!, requestId: id, status: 'active' }, orderBy: { createdAt: 'asc' } });
            if (!active.length) throw new BadRequestException('Rezervsiz sərbəst stok yoxdur; təminat gözlənilir');
            let moved = new Prisma.Decimal(0);
            for (const reservation of active) {
              const stock = await tx.stock.findFirst({ where: { organizationId: ctx.orgId!, materialId: request.materialId, locationId: reservation.locationId } });
              if (!stock || stock.qty.lessThan(reservation.qty)) throw new ConflictException('Rezerv mənbəyində fiziki qalıq çatmır; uzlaşdırma tələb olunur');
              await tx.stock.update({ where: { id: stock.id }, data: { qty: { decrement: reservation.qty } } });
              await tx.stock.upsert({ where: { materialId_locationId: { materialId: request.materialId, locationId: destination.id } }, update: { qty: { increment: reservation.qty } }, create: { organizationId: ctx.orgId!, materialId: request.materialId, locationId: destination.id, qty: reservation.qty } });
              await tx.movement.create({ data: { organizationId: ctx.orgId!, materialId: material.id, material: material.name, type: 'transfer', qty: reservation.qty, unit: request.unit, project: request.project, locationId: destination.id, from: reservation.locationId, date: now.slice(0, 10), by: user.name, note: `Tələb ${request.id}` } });
              await tx.stockReservation.update({ where: { id: reservation.id }, data: { status: 'consumed', resolvedAt: new Date(now), resolvedBy: user.name } });
              moved = moved.plus(reservation.qty);
            }
            const fulfilledQty = request.fulfilledQty.plus(moved);
            const complete = fulfilledQty.greaterThanOrEqualTo(request.qty);
            await tx.materialRequest.update({ where: { id }, data: { fulfilledQty, status: complete ? 'anbar' : 'tesdiq', decidedBy: user.name, decision: `${fulfilledQty.toString()} / ${request.qty.toString()} ${request.unit} sahəyə köçürüldü${complete ? '' : ' · qalıq üçün əlavə sərbəst stok gözlənilir'}` } });
            nextStatus = complete ? 'anbar' : 'tesdiq'; details = { movedQty: moved.toString(), fulfilledQty: fulfilledQty.toString(), requestedQty: request.qty.toString(), locationId: destination.id };
          }

          await tx.auditEntry.create({ data: { organizationId: ctx.orgId!, at: now, actor: user.name, role: user.role, action: `Material sorğusu: ${decision}`, detail: JSON.stringify({ id, before: request.status, after: nextStatus, ...details }) } });
          await tx.operationReceipt.create({ data: { organizationId: ctx.orgId!, accountId: ctx.accountId, key: rowKey, requestHash: hash, command: `request-${decision}`, changedBooks: { requestId: id, status: nextStatus, ...details } as Prisma.InputJsonValue } });
          return { replayed: false, details };
        }, 60000);
        const resultDetails = 'details' in result ? (result as {details?:Record<string,unknown>}).details : undefined;
        results.push({ id, ok: true, message: result.replayed ? 'Əvvəlki əməliyyat təkrar tanındı' : decision === 'approve' && resultDetails ? `Rezerv: ${resultDetails.reservedQty} · təminat gözləyən: ${resultDetails.uncoveredQty}` : decision === 'fulfill' && resultDetails ? `Köçürüldü: ${resultDetails.movedQty} · ümumi: ${resultDetails.fulfilledQty}/${resultDetails.requestedQty}` : 'Qərar qeydə alındı', replayed: result.replayed });
      } catch (error) {
        const response=error instanceof HttpException?error.getResponse():null;
        const message=typeof response==='string'?response:response&&typeof response==='object'&&'message' in response?String((response as {message:unknown}).message):error instanceof Error?error.message:'Əməliyyat alınmadı';
        results.push({ id, ok: false, message });
      }
    }
    return { results, succeeded: results.filter((row) => row.ok).length, failed: results.filter((row) => !row.ok).length };
  }

  private async reserveAvailable(tx: Prisma.TransactionClient, organizationId: string, requestId: string, materialId: string, amount: Prisma.Decimal, createdBy: string) {
    if (!amount.greaterThan(0)) return new Prisma.Decimal(0);
    const eligibleLocations = await tx.location.findMany({ where: { organizationId, projectId: null } });
    const locationIds = eligibleLocations.map((location) => location.id);
    if (!locationIds.length) return new Prisma.Decimal(0);
    const stocks = await tx.stock.findMany({ where: { organizationId, materialId, locationId: { in: locationIds }, qty: { gt: 0 } }, orderBy: { qty: 'desc' } });
    const held = await tx.stockReservation.findMany({ where: { organizationId, materialId, locationId: { in: locationIds }, status: 'active' } });
    const reservedByLocation = new Map<string, Prisma.Decimal>();
    for (const row of held) reservedByLocation.set(row.locationId, (reservedByLocation.get(row.locationId) || new Prisma.Decimal(0)).plus(row.qty));
    const transferHolds = await tx.shipmentLine.findMany({ where: { materialId, shipment: { organizationId, fromLocationId: { in: locationIds }, status: { in: ['waiting_sender', 'sent'] } } }, include: { shipment: { select: { fromLocationId: true } } } });
    for (const row of transferHolds) {
      const locationId = row.shipment.fromLocationId;
      if (locationId) reservedByLocation.set(locationId, (reservedByLocation.get(locationId) || new Prisma.Decimal(0)).plus(row.qty));
    }
    let remaining = amount;
    let reserved = new Prisma.Decimal(0);
    for (const stock of stocks) {
      if (!remaining.greaterThan(0)) break;
      const free = stock.qty.minus(reservedByLocation.get(stock.locationId) || new Prisma.Decimal(0));
      if (!free.greaterThan(0)) continue;
      const take = Prisma.Decimal.min(remaining, free);
      await tx.stockReservation.create({ data: { organizationId, requestId, materialId, locationId: stock.locationId, qty: take, status: 'active', createdBy } });
      remaining = remaining.minus(take); reserved = reserved.plus(take);
    }
    return reserved;
  }
}
