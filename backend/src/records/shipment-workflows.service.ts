import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';

type InputLine = { materialId: string; qty: string; material?: string };

@Injectable()
export class ShipmentWorkflowsService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantService) {}

  async list(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    if (['direktor', 'sahe', 'layihe', 'muhendis'].includes(ctx.seat || '')) this.tenant.allow(ctx, 'weather');
    else this.tenant.allow(ctx, 'warehouse');
    const organizationId = this.tenant.requireOrg(ctx);
    const rows = await this.prisma.shipment.findMany({ where: { organizationId }, include: { lines: { orderBy: { sort: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 500 });
    const endpointIds = [...new Set(rows.flatMap((row) => [row.fromLocationId || row.stops[0], row.toLocationId || row.stops[row.stops.length - 1]]).filter((id): id is string => Boolean(id)))];
    const endpoints = await this.prisma.location.findMany({ where: { organizationId, id: { in: endpointIds } }, select: { id: true, name: true, projectId: true } });
    const byId = new Map(endpoints.map((location) => [location.id, location]));
    const assignments = await this.prisma.projectAssignment.findMany({ where: { organizationId, accountId: ctx.accountId, active: true } });
    const assignmentByProject = new Map(assignments.map((assignment) => [assignment.projectId, assignment]));
    const valuationVisible = !['warehouse', 'site'].includes(user.role);
    return rows.map((row) => {
      const from = byId.get(row.fromLocationId || row.stops[0]);
      const to = byId.get(row.toLocationId || row.stops[row.stops.length - 1]);
      const fromAssignment = from?.projectId ? assignmentByProject.get(from.projectId) : undefined;
      const toAssignment = to?.projectId ? assignmentByProject.get(to.projectId) : undefined;
      const canSignProjectSend = ctx.seat === 'direktor' || (['sahe', 'layihe'].includes(ctx.seat || '') && fromAssignment?.canSendTransfers === true);
      const canSignProjectReceive = ctx.seat === 'direktor' || (['sahe', 'layihe'].includes(ctx.seat || '') && toAssignment?.canReceiveTransfers === true);
      const canSignWarehouse = ['direktor', 'anbardar'].includes(ctx.seat || '');
      return {
        id: row.id, stops: row.stops, step: row.step, date: row.date, by: row.by, note: row.note, status: row.status,
        fromLocationId: row.fromLocationId, toLocationId: row.toLocationId,
        fromLocationName: from?.name || '', toLocationName: to?.name || '', toProjectId: to?.projectId || null, valuationVisible,
        canDispatch: from?.projectId ? canSignProjectSend : canSignWarehouse,
        canReceive: to?.projectId ? canSignProjectReceive : ['direktor', 'anbardar'].includes(ctx.seat || ''),
        canCancel: from?.projectId ? canSignProjectSend : canSignWarehouse,
        createdBy: row.createdBy, dispatchedBy: row.dispatchedBy, dispatchedAt: row.dispatchedAt,
        receivedBy: row.receivedBy, receivedAt: row.receivedAt, cancelReason: row.cancelReason,
        lines: row.lines.map((line) => ({ materialId: line.materialId, material: line.material, qty: line.qty.toNumber(), unit: line.unit, ...(valuationVisible ? { price: line.price.toNumber(), amount: line.amount.toNumber() } : {}) })),
      };
    });
  }

  async create(user: AuthUser, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    if (!['direktor', 'anbardar', 'satinalma'].includes(ctx.seat || '')) throw new ForbiddenException('Transfer sənədini anbar və ya satınalma səlahiyyətlisi yaradır');
    const fromLocationId = String(body.fromLocationId || '');
    const toLocationId = String(body.toLocationId || '');
    const note = String(body.note || '').trim();
    const id = String(body.id || '');
    const key = this.key(body.key);
    const lines = this.lines(body.lines);
    if (!id || id.length > 80 || fromLocationId === toLocationId) throw new BadRequestException('Transfer nömrəsi və fərqli başlanğıc/hədəf anbar seçin');
    const hash = createHash('sha256').update(JSON.stringify({ id, fromLocationId, toLocationId, note, lines })).digest('hex');
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.orgId!}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId: ctx.orgId!, key } } });
      if (replay) {
        if (replay.requestHash !== hash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı başqa transferə aiddir');
        return { id, status: 'waiting_sender', replayed: true };
      }
      const [from, to] = await Promise.all([
        tx.location.findFirst({ where: { id: fromLocationId, organizationId: ctx.orgId! } }),
        tx.location.findFirst({ where: { id: toLocationId, organizationId: ctx.orgId! } }),
      ]);
      if (!from || !to) throw new NotFoundException('Başlanğıc və ya hədəf anbar tapılmadı');
      const materialRows = await tx.material.findMany({ where: { organizationId: ctx.orgId!, id: { in: lines.map((line) => line.materialId) } } });
      if (materialRows.length !== lines.length) throw new BadRequestException('Material yoxdur və ya başqa şirkətə aiddir');
      for (const line of lines) {
        const material = materialRows.find((item) => item.id === line.materialId)!;
        const stock = await tx.stock.findFirst({ where: { organizationId: ctx.orgId!, materialId: line.materialId, locationId: fromLocationId } });
        const requestReservations = await tx.stockReservation.findMany({ where: { organizationId: ctx.orgId!, materialId: line.materialId, locationId: fromLocationId, status: 'active' } });
        const transferLines = await tx.shipmentLine.findMany({ where: { materialId: line.materialId, shipment: { organizationId: ctx.orgId!, fromLocationId, status: { in: ['waiting_sender', 'sent'] } } } });
        const reserved = requestReservations.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0));
        const inTransfer = transferLines.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0));
        const free = (stock?.qty || new Prisma.Decimal(0)).minus(reserved).minus(inTransfer);
        const wanted = new Prisma.Decimal(line.qty);
        if (free.lessThan(wanted)) throw new BadRequestException(`${material.name}: sərbəst qalıq ${Prisma.Decimal.max(0, free).toString()} ${material.unit}, transfer miqdarı ${wanted.toString()} ${material.unit}`);
      }
      const date = new Date().toISOString();
      await tx.shipment.create({ data: {
        id, organizationId: ctx.orgId!, stops: [fromLocationId, toLocationId], step: 0, date: date.slice(0, 10), by: user.name,
        note, fromLocationId, toLocationId, status: 'waiting_sender', createdBy: user.name, createdById: user.userId,
        lines: { create: lines.map((line, sort) => { const material = materialRows.find((item) => item.id === line.materialId)!; const qty = new Prisma.Decimal(line.qty); return { sort, materialId: material.id, material: material.name, qty, unit: material.unit, price: material.price, amount: qty.mul(material.price).toDecimalPlaces(2) }; }) },
      } });
      const detail = { shipmentId: id, fromLocationId, toLocationId, status: 'waiting_sender', lines };
      await tx.auditEntry.create({ data: { organizationId: ctx.orgId!, at: date, actor: user.name, role: user.role, action: 'Anbar transferi yaradıldı', detail: JSON.stringify(detail) } });
      await tx.operationReceipt.create({ data: { organizationId: ctx.orgId!, accountId: ctx.accountId, key, requestHash: hash, command: 'shipment-create', changedBooks: detail as Prisma.InputJsonValue } });
      return { id, status: 'waiting_sender', replayed: false };
    }, 60000);
  }

  async dispatch(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    const organizationId = this.tenant.requireOrg(ctx);
    const key = this.key(body.key);
    return this.transition(organizationId, ctx.accountId, user, key, id, 'shipment-dispatch', {}, async (tx) => {
      const row = await tx.shipment.findFirst({ where: { id, organizationId: ctx.orgId! }, include: { lines: true } });
      if (!row) throw new NotFoundException('Transfer sənədi tapılmadı');
      if (row.status !== 'waiting_sender') throw new ConflictException('Transfer göndərən imzasını gözləmir');
      const from = await tx.location.findFirst({ where: { id: row.fromLocationId || '', organizationId: ctx.orgId! } });
      if (!from) throw new NotFoundException('Başlanğıc anbar tapılmadı');
      if (from.projectId) {
        this.tenant.allow(ctx, 'weather');
        const assignment = await tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId: ctx.orgId!, accountId: ctx.accountId, projectId: from.projectId } } });
        if (ctx.seat !== 'direktor' && (!['sahe', 'layihe'].includes(ctx.seat || '') || !assignment?.active || !assignment.canSendTransfers)) throw new ForbiddenException('Mənbə layihəyə göndərən səlahiyyəti təyin edilməyib');
      } else {
        this.tenant.allow(ctx, 'warehouse');
        if (!['direktor', 'anbardar'].includes(ctx.seat || '')) throw new ForbiddenException('Ümumi anbardan çıxışı anbar məsulu imzalamalıdır');
      }
      const at = new Date();
      await tx.shipment.update({ where: { id }, data: { status: 'sent', dispatchedBy: user.name, dispatchedById: user.userId, dispatchedAt: at, by: user.name, step: 0 } });
      return { before: row, after: { status: 'sent', dispatchedBy: user.name, dispatchedById: user.userId, dispatchedAt: at.toISOString() } };
    });
  }

  async receive(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    const orgId=this.tenant.requireOrg(ctx);
    const key = this.key(body.key);
    return this.transition(orgId, ctx.accountId, user, key, id, 'shipment-receive', {}, async (tx) => {
      const row = await tx.shipment.findFirst({ where: { id, organizationId: ctx.orgId! }, include: { lines: { orderBy: { sort: 'asc' } } } });
      if (!row) throw new NotFoundException('Transfer sənədi tapılmadı');
      if (row.status !== 'sent') throw new ConflictException('Qəbul imzası yalnız yola salınmış transferə verilir');
      if (row.dispatchedById === user.userId) throw new ForbiddenException('Qəbul edən imzası göndərən imzasından fərqli şəxsə aid olmalıdır');
      const [from, to] = await Promise.all([
        tx.location.findFirst({ where: { id: row.fromLocationId || '', organizationId: ctx.orgId! } }),
        tx.location.findFirst({ where: { id: row.toLocationId || '', organizationId: ctx.orgId! } }),
      ]);
      if (!from || !to) throw new NotFoundException('Transfer anbarlarından biri tapılmadı');
      if (to.projectId) {
        this.tenant.allow(ctx, 'weather');
        const assignment = await tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId: ctx.orgId!, accountId: ctx.accountId, projectId: to.projectId } } });
        if (ctx.seat !== 'direktor' && (!['sahe', 'layihe'].includes(ctx.seat || '') || !assignment?.active || !assignment.canReceiveTransfers)) throw new ForbiddenException('Hədəf layihəyə qəbul səlahiyyəti təyin edilməyib');
      } else {
        this.tenant.allow(ctx, 'warehouse');
        if (!['direktor', 'anbardar'].includes(ctx.seat || '')) throw new ForbiddenException('Ümumi anbarı anbar məsul şəxsi qəbul etməlidir');
      }
      const at = new Date();
      const project = to.projectId ? await tx.project.findFirst({ where: { id: to.projectId, organizationId: ctx.orgId! } }) : null;
      const lotTransfers: { sourceLotId: string; targetQr: string; qty: string }[] = [];
      for (const line of row.lines) {
        const stock = await tx.stock.findFirst({ where: { organizationId: ctx.orgId!, materialId: line.materialId, locationId: from.id } });
        const reserved = await tx.stockReservation.findMany({ where: { organizationId: ctx.orgId!, materialId: line.materialId, locationId: from.id, status: 'active' } });
        const otherShipments = await tx.shipmentLine.findMany({ where: { materialId: line.materialId, shipmentId: { not: id }, shipment: { organizationId: ctx.orgId!, fromLocationId: from.id, status: { in: ['waiting_sender', 'sent'] } } } });
        const protectedQty = reserved.reduce((sum, item) => sum.plus(item.qty), new Prisma.Decimal(0)).plus(otherShipments.reduce((sum, item) => sum.plus(item.qty), new Prisma.Decimal(0)));
        if (!stock || stock.qty.minus(line.qty).lessThan(protectedQty)) throw new ConflictException(`${line.material}: göndərilən miqdar artıq sərbəst deyil; stok uzlaşdırılması lazımdır`);
        const sourceLots = await tx.stockLot.findMany({ where: { organizationId: ctx.orgId!, materialId: line.materialId, locationId: from.id, qty: { gt: 0 } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
        let left = new Prisma.Decimal(line.qty);
        const allocations: { lot: typeof sourceLots[number]; qty: Prisma.Decimal }[] = [];
        for (const lot of sourceLots) {
          if (!left.greaterThan(0)) break;
          const take = Prisma.Decimal.min(left, lot.qty);
          if (!take.greaterThan(0)) continue;
          allocations.push({ lot, qty: take });
          left = left.minus(take);
        }
        if (left.greaterThan(0)) throw new ConflictException(`${line.material}: anbar üzrə partiya qalığı transfer miqdarını ödəmir; əvvəl stok/partiya uzlaşdırması aparın`);
        for (const allocation of allocations) {
          const targetQr = `TR:${id}:${allocation.lot.id}`;
          await tx.stockLot.update({ where: { id: allocation.lot.id }, data: { qty: { decrement: allocation.qty } } });
          await tx.stockLot.create({ data: { organizationId: ctx.orgId!, materialId: line.materialId, locationId: to.id, code: allocation.lot.code, batch: allocation.lot.batch, qty: allocation.qty, unitCost: allocation.lot.unitCost, expiresOn: allocation.lot.expiresOn, qr: targetQr } });
          lotTransfers.push({ sourceLotId: allocation.lot.id, targetQr, qty: allocation.qty.toString() });
        }
        await tx.stock.update({ where: { id: stock.id }, data: { qty: { decrement: line.qty } } });
        await tx.stock.upsert({ where: { materialId_locationId: { materialId: line.materialId, locationId: to.id } }, update: { qty: { increment: line.qty } }, create: { organizationId: ctx.orgId!, materialId: line.materialId, locationId: to.id, qty: line.qty } });
        await tx.movement.create({ data: { organizationId: ctx.orgId!, materialId: line.materialId, material: line.material, type: 'transfer', qty: line.qty, unit: line.unit, project: project?.name || '—', locationId: to.id, from: from.id, date: at.toISOString().slice(0, 10), by: user.name, note: `Transfer ${id} · göndərən: ${row.dispatchedBy}` } });
      }
      await tx.shipment.update({ where: { id }, data: { status: 'received', receivedBy: user.name, receivedById: user.userId, receivedAt: at, step: 1 } });
      return { before: row, after: { status: 'received', receivedBy: user.name, receivedById: user.userId, receivedAt: at.toISOString(), lines: row.lines, lotTransfers } };
    });
  }

  async cancel(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    const organizationId = this.tenant.requireOrg(ctx);
    const reason = String(body.reason || '').trim();
    if (!reason) throw new BadRequestException('Transferin ləğv səbəbini yazın');
    return this.transition(organizationId, ctx.accountId, user, this.key(body.key), id, 'shipment-cancel', { reason }, async (tx) => {
      const row = await tx.shipment.findFirst({ where: { id, organizationId: ctx.orgId! }, include: { lines: true } });
      if (!row) throw new NotFoundException('Transfer sənədi tapılmadı');
      if (row.status !== 'waiting_sender') throw new ConflictException('Göndərilmiş və ya qəbul edilmiş transfer ləğv edilmir');
      const from = await tx.location.findFirst({ where: { id: row.fromLocationId || '', organizationId: ctx.orgId! } });
      if (!from) throw new NotFoundException('Başlanğıc anbar tapılmadı');
      if (from.projectId) {
        this.tenant.allow(ctx, 'weather');
        const assignment = await tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId: ctx.orgId!, accountId: ctx.accountId, projectId: from.projectId } } });
        if (ctx.seat !== 'direktor' && (!['sahe', 'layihe'].includes(ctx.seat || '') || !assignment?.active || !assignment.canSendTransfers)) throw new ForbiddenException('Mənbə layihəyə göndərən səlahiyyəti təyin edilməyib');
      } else {
        this.tenant.allow(ctx, 'warehouse');
        if (!['direktor', 'anbardar'].includes(ctx.seat || '')) throw new ForbiddenException('Anbar transferini anbar məsulu ləğv etməlidir');
      }
      const at = new Date();
      await tx.shipment.update({ where: { id }, data: { status: 'cancelled', cancelledBy: user.name, cancelledById: user.userId, cancelledAt: at, cancelReason: reason } });
      return { before: row, after: { status: 'cancelled', cancelledBy: user.name, cancelledById: user.userId, reason } };
    });
  }

  private async transition(orgId: string, accountId: string, user: AuthUser, key: string, id: string, command: string, payload: Record<string, unknown>, work: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const hash = createHash('sha256').update(JSON.stringify({ command, id, payload })).digest('hex');
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId: orgId, key } } });
      if (replay) {
        if (replay.requestHash !== hash || replay.accountId !== accountId) throw new ConflictException('Əməliyyat açarı başqa sənədə aiddir');
        return { id, replayed: true };
      }
      const snapshot = await work(tx);
      const at = new Date().toISOString();
      await tx.auditEntry.create({ data: { organizationId: orgId, at, actor: user.name, role: user.role, action: command, detail: JSON.stringify({ id, snapshot }) } });
      await tx.operationReceipt.create({ data: { organizationId: orgId, accountId, key, requestHash: hash, command, changedBooks: JSON.parse(JSON.stringify({ shipmentId: id, snapshot })) as Prisma.InputJsonValue } });
      return { id, replayed: false };
    }, 60000);
  }

  private key(value: unknown) {
    const key = String(value || '');
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new BadRequestException('Əməliyyat açarı düzgün deyil');
    return key;
  }

  private lines(input: unknown): InputLine[] {
    if (!Array.isArray(input) || !input.length || input.length > 100) throw new BadRequestException('1–100 material sətri daxil edin');
    const lines = input.map((value) => {
      if (!value || typeof value !== 'object') throw new BadRequestException('Transfer material sətri düzgün deyil');
      const row = value as Record<string, unknown>;
      const materialId = String(row.materialId || '');
      const qty = String(row.qty || '');
      if (!materialId || !/^\d{1,11}(?:\.\d{1,3})?$/.test(qty) || !new Prisma.Decimal(qty).greaterThan(0)) throw new BadRequestException('Material və 3 rəqəm dəqiqliyində müsbət miqdar daxil edin');
      return { materialId, qty };
    });
    if (new Set(lines.map((line) => line.materialId)).size !== lines.length) throw new BadRequestException('Eyni materialı bir transfer sənədində təkrarlamayın');
    return lines;
  }
}
