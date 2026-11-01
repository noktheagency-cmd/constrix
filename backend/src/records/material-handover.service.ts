import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';

@Injectable()
export class MaterialHandoverService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantService) {}

  async custodians(user: AuthUser, projectId: string) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    const organizationId = this.tenant.requireOrg(ctx);
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } });
    if (!project) throw new NotFoundException('Layihə tapılmadı');
    const rows = await this.prisma.projectAssignment.findMany({
      where: { organizationId, projectId, active: true, canHoldMaterials: true },
      include: { account: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const members = await this.prisma.organizationMember.findMany({ where: { organizationId, accountId: { in: rows.map((row) => row.accountId) } }, select: { accountId: true, seatRole: true } });
    const seats = new Map(members.map((row) => [row.accountId, row.seatRole]));
    return rows.filter((row) => ['sahe', 'layihe'].includes(seats.get(row.accountId) || '')).map((row) => ({ accountId: row.account.id, name: row.account.name, email: row.account.email, seatRole: seats.get(row.accountId) || '' }));
  }

  async list(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    const warehouseRole = ['direktor', 'anbardar'].includes(ctx.seat || '') || ['director', 'warehouse'].includes(user.role);
    if (warehouseRole) this.tenant.allow(ctx, 'warehouse');
    else this.tenant.allow(ctx, 'weather');
    const rows = await this.prisma.materialHandover.findMany({
      where: {
        organizationId: this.tenant.requireOrg(ctx),
        ...(!warehouseRole ? { custodianAccountId: ctx.accountId } : {}),
      },
      include: {
        project: { select: { name: true } },
        location: { select: { name: true } },
        material: { select: { name: true, unit: true } },
        custodian: { select: { name: true } },
        actions: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const balances = new Map<string, Prisma.Decimal>();
    const acceptedBalances = await this.prisma.materialHandover.groupBy({
      by: ['custodianAccountId', 'locationId', 'materialId'],
      where: { organizationId: this.tenant.requireOrg(ctx), status: 'accepted' },
      _sum: { remainingQty: true },
    });
    for (const row of acceptedBalances) {
      const key = `${row.custodianAccountId}\u0000${row.locationId}\u0000${row.materialId}`;
      balances.set(key, row._sum.remainingQty || new Prisma.Decimal(0));
    }
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      projectName: row.project.name,
      locationId: row.locationId,
      locationName: row.location.name,
      materialId: row.materialId,
      materialName: row.material.name,
      unit: row.material.unit,
      custodianAccountId: row.custodianAccountId,
      custodianName: row.custodian.name,
      qty: row.qty.toNumber(),
      remainingQty: row.remainingQty.toNumber(),
      custodyBalanceQty: (balances.get(`${row.custodianAccountId}\u0000${row.locationId}\u0000${row.materialId}`) || new Prisma.Decimal(0)).toNumber(),
      status: row.status,
      reason: row.reason,
      createdBy: row.createdBy,
      createdById: row.createdById,
      acceptedBy: row.acceptedBy,
      acceptedById: row.acceptedById,
      acceptedAt: row.acceptedAt?.toISOString() || null,
      cancelledBy: row.cancelledBy,
      cancelledAt: row.cancelledAt?.toISOString() || null,
      cancelReason: row.cancelReason,
      createdAt: row.createdAt.toISOString(),
      actions: row.actions.map((action) => ({ id: action.id, kind: action.kind, qty: action.qty.toNumber(), status: action.status, reason: action.reason, requestedBy: action.requestedBy, requestedById: action.requestedById, reviewedBy: action.reviewedBy, reviewedAt: action.reviewedAt?.toISOString() || null, reviewReason: action.reviewReason, createdAt: action.createdAt.toISOString() })),
    }));
  }

  async holds(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    const warehouseRole = ['direktor', 'anbardar'].includes(ctx.seat || '') || ['director', 'warehouse'].includes(user.role);
    if (warehouseRole) this.tenant.allow(ctx, 'warehouse');
    else this.tenant.allow(ctx, 'weather');
    const handovers = await this.prisma.materialHandover.findMany({
      where: {
        organizationId: this.tenant.requireOrg(ctx),
        status: { in: ['waiting_custodian', 'accepted'] },
        ...(!warehouseRole ? { custodianAccountId: ctx.accountId } : {}),
      },
      select: { materialId: true, locationId: true, status: true, qty: true, remainingQty: true },
    });
    const balances = new Map<string, Prisma.Decimal>();
    for (const row of handovers) {
      const key = `${row.materialId}\u0000${row.locationId}`;
      const qty = row.status === 'accepted' ? row.remainingQty : row.qty;
      balances.set(key, (balances.get(key) || new Prisma.Decimal(0)).plus(qty));
    }
    return [...balances.entries()].map(([key, qty]) => { const [materialId, locationId] = key.split('\u0000'); return { materialId, locationId, qty: qty.toNumber() }; });
  }

  async create(user: AuthUser, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    if (!['direktor', 'anbardar'].includes(ctx.seat || '') && !['director', 'warehouse'].includes(user.role)) {
      throw new ForbiddenException('Material təhvilini yalnız direktor və anbar məsulu yarada bilər');
    }
    const organizationId = this.tenant.requireOrg(ctx);
    const projectId = String(body.projectId || '').trim();
    const locationId = String(body.locationId || '').trim();
    const materialId = String(body.materialId || '').trim();
    const custodianAccountId = String(body.custodianAccountId || '').trim();
    const reason = String(body.reason || '').trim();
    const qtyText = String(body.qty || '');
    const key = this.key(body.key);
    const id = String(body.id || randomUUID());
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id) || !projectId || !locationId || !materialId || !custodianAccountId || !/^\d{1,11}(?:\.\d{1,3})?$/.test(qtyText) || !new Prisma.Decimal(qtyText).greaterThan(0)) {
      throw new BadRequestException('Layihə, anbar, material, məsul şəxs və müsbət 3 rəqəm dəqiqliyində miqdar seçin');
    }
    if (reason.length > 500) throw new BadRequestException('Qeyd 500 simvoldan çox ola bilməz');
    const qty = new Prisma.Decimal(qtyText);
    const hash = this.hash({ id, projectId, locationId, materialId, custodianAccountId, qty: qty.toString(), reason });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) {
        if (replay.requestHash !== hash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı başqa təhvilə aiddir');
        return { id, status: 'waiting_custodian', replayed: true };
      }
      const [project, location, material, member, assignment] = await Promise.all([
        tx.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true, name: true } }),
        tx.location.findFirst({ where: { id: locationId, organizationId }, select: { id: true, projectId: true } }),
        tx.material.findFirst({ where: { id: materialId, organizationId }, select: { id: true, name: true, unit: true } }),
        tx.organizationMember.findFirst({ where: { organizationId, accountId: custodianAccountId }, select: { seatRole: true } }),
        tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId, accountId: custodianAccountId, projectId } } }),
      ]);
      if (!project || !location || location.projectId !== projectId || !material || !member) throw new NotFoundException('Layihə, layihə anbarı, material və ya şirkət üzvü tapılmadı');
      if (!['sahe', 'layihe'].includes(member.seatRole) || !assignment?.active || !assignment.canHoldMaterials) throw new ForbiddenException('Məsul şəxsə bu layihə üzrə material təhvil səlahiyyəti verilməyib');
      const [stock, reservations, transfers, existingHandovers] = await Promise.all([
        tx.stock.findFirst({ where: { organizationId, materialId, locationId } }),
        tx.stockReservation.findMany({ where: { organizationId, materialId, locationId, status: 'active' } }),
        tx.shipmentLine.findMany({ where: { materialId, shipment: { organizationId, fromLocationId: locationId, status: { in: ['waiting_sender', 'sent'] } } } }),
        tx.materialHandover.findMany({ where: { organizationId, materialId, locationId, status: { in: ['waiting_custodian', 'accepted'] } } }),
      ]);
      const protectedQty = reservations.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0))
        .plus(transfers.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0)))
        .plus(existingHandovers.reduce((sum, row) => sum.plus(row.status === 'accepted' ? row.remainingQty : row.qty), new Prisma.Decimal(0)));
      const available = (stock?.qty || new Prisma.Decimal(0)).minus(protectedQty);
      if (available.lessThan(qty)) throw new BadRequestException(`${material.name}: təhvil üçün sərbəst qalıq ${Prisma.Decimal.max(0, available).toString()} ${material.unit}`);
      const row = await tx.materialHandover.create({ data: { id, organizationId, projectId, locationId, materialId, custodianAccountId, qty, remainingQty: 0, reason, createdBy: user.name, createdById: user.userId } });
      const detail = { handoverId: id, projectId, locationId, materialId, custodianAccountId, qty: qty.toString(), status: row.status };
      const at = new Date().toISOString();
      await tx.auditEntry.create({ data: { organizationId, at, actor: user.name, role: user.role, action: 'Material məsul şəxsə təhvil üçün yaradıldı', detail: JSON.stringify(detail) } });
      await tx.operationReceipt.create({ data: { organizationId, accountId: ctx.accountId, key, requestHash: hash, command: 'material-handover-create', changedBooks: detail as Prisma.InputJsonValue } });
      return { id, status: row.status, replayed: false };
    }, 60000);
  }

  async accept(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    return this.transition(organizationId, ctx.accountId, user, id, 'material-handover-accept', body, async (tx) => {
      const row = await tx.materialHandover.findFirst({ where: { id, organizationId } });
      if (!row) throw new NotFoundException('Təhvil sənədi tapılmadı');
      if (row.custodianAccountId !== ctx.accountId) throw new ForbiddenException('Təhvili yalnız təyin edilmiş məsul şəxs qəbul edə bilər');
      if (row.status !== 'waiting_custodian') throw new ConflictException('Təhvil artıq qəbul edilib və ya ləğv olunub');
      if (row.createdById && row.createdById === user.userId) throw new ForbiddenException('Təhvil verən və qəbul edən fərqli istifadəçi olmalıdır');
      const assignment = await tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId, accountId: ctx.accountId, projectId: row.projectId } } });
      if (!assignment?.active || !assignment.canHoldMaterials) throw new ForbiddenException('Layihə üzrə material təhvil təyinatı yoxdur və ya deaktivdir');
      const acceptedAt = new Date();
      const updated = await tx.materialHandover.update({ where: { id }, data: { status: 'accepted', remainingQty: row.qty, acceptedBy: user.name, acceptedById: user.userId, acceptedAt } });
      return { before: row, after: updated };
    });
  }

  async requestAction(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    const kind = String(body.kind || '');
    const reason = String(body.reason || '').trim();
    const qtyText = String(body.qty || '');
    const key = this.key(body.key);
    const actionId = String(body.id || randomUUID());
    if (!['consume', 'return'].includes(kind) || !/^[a-zA-Z0-9_-]{8,80}$/.test(actionId) || !/^\d{1,11}(?:\.\d{1,3})?$/.test(qtyText) || !new Prisma.Decimal(qtyText).greaterThan(0) || !reason || reason.length > 500) {
      throw new BadRequestException('Sərfiyyat/qaytarma növü, müsbət miqdar və 500 simvoldan qısa səbəb yazın');
    }
    const qty = new Prisma.Decimal(qtyText);
    const hash = this.hash({ id, actionId, kind, qty: qty.toString(), reason });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) {
        if (replay.requestHash !== hash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı başqa sərfiyyat/qaytarma sorğusuna aiddir');
        return { id: actionId, status: 'pending', replayed: true };
      }
      const handover = await tx.materialHandover.findFirst({ where: { id, organizationId } });
      if (!handover) throw new NotFoundException('Təhvil sənədi tapılmadı');
      if (handover.custodianAccountId !== ctx.accountId || handover.status !== 'accepted') throw new ForbiddenException('Sərfiyyat və ya qaytarma sorğusunu yalnız təhvili qəbul etmiş məsul şəxs yarada bilər');
      const pending = await tx.materialCustodyAction.findMany({ where: { organizationId, handoverId: id, status: 'pending' } });
      const pendingQty = pending.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0));
      if (pendingQty.plus(qty).greaterThan(handover.remainingQty)) throw new ConflictException(`Sorğu miqdarı qalıqdan çoxdur. Təsdiqlənən qalıq: ${handover.remainingQty.toString()}`);
      const row = await tx.materialCustodyAction.create({ data: { id: actionId, organizationId, handoverId: id, kind, qty, reason, requestedBy: user.name, requestedById: ctx.accountId } });
      const detail = { handoverId: id, actionId, kind, qty: qty.toString(), status: row.status };
      const at = new Date().toISOString();
      await tx.auditEntry.create({ data: { organizationId, at, actor: user.name, role: user.role, action: kind === 'consume' ? 'Material sərfiyyatı təsdiq üçün göndərildi' : 'Material qaytarılması təsdiq üçün göndərildi', detail: JSON.stringify(detail) } });
      await tx.operationReceipt.create({ data: { organizationId, accountId: ctx.accountId, key, requestHash: hash, command: 'material-custody-action-request', changedBooks: detail as Prisma.InputJsonValue } });
      return { id: row.id, status: row.status, replayed: false };
    }, 60000);
  }

  async reviewAction(user: AuthUser, actionId: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    const decision = String(body.decision || '');
    const reviewReason = String(body.reason || '').trim();
    if (!['approve', 'reject'].includes(decision) || (decision === 'reject' && !reviewReason)) throw new BadRequestException('Təsdiq və ya rədd qərarı seçin; rədd üçün səbəb yazılmalıdır');
    return this.transition(organizationId, ctx.accountId, user, actionId, 'material-custody-action-review', { ...body, decision, reason: reviewReason }, async (tx) => {
      const action = await tx.materialCustodyAction.findFirst({ where: { id: actionId, organizationId }, include: { handover: { include: { project: { select: { name: true } }, material: { select: { name: true, unit: true } } } } } });
      if (!action) throw new NotFoundException('Sərfiyyat/qaytarma sorğusu tapılmadı');
      if (action.status !== 'pending') throw new ConflictException('Sorğu artıq nəzərdən keçirilib');
      if (action.requestedById === ctx.accountId) throw new ForbiddenException('Sorğunu yaradan istifadəçi həmin sorğunu təsdiqləyə bilməz');
      const assignment = await tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId, accountId: ctx.accountId, projectId: action.handover.projectId } } });
      if (!['director', 'pm'].includes(user.role) && (!assignment?.active || !assignment.canReviewMaterialUsage)) throw new ForbiddenException('Sərfiyyatı yalnız direktor, layihə rəhbəri və ya təyin edilmiş nəzarətçi təsdiqləyə bilər');
      const otherPending = await tx.materialCustodyAction.findMany({ where: { organizationId, handoverId: action.handoverId, status: 'pending', id: { not: action.id } } });
      const protectedQty = otherPending.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0)).plus(action.qty);
      if (protectedQty.greaterThan(action.handover.remainingQty)) throw new ConflictException('Təhvil üzrə qalıq paralel sorğularla dəyişib; yenidən hesablayın');
      let movementId: string | undefined;
      if (decision === 'approve' && action.kind === 'consume') {
        const [stock, material, lots, reservations, transfers, handovers] = await Promise.all([
          tx.stock.findFirst({ where: { organizationId, materialId: action.handover.materialId, locationId: action.handover.locationId } }),
          tx.material.findFirst({ where: { organizationId, id: action.handover.materialId } }),
          tx.stockLot.findMany({ where: { organizationId, materialId: action.handover.materialId, locationId: action.handover.locationId, qty: { gt: 0 } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
          tx.stockReservation.findMany({ where: { organizationId, materialId: action.handover.materialId, locationId: action.handover.locationId, status: 'active' } }),
          tx.shipmentLine.findMany({ where: { materialId: action.handover.materialId, shipment: { organizationId, fromLocationId: action.handover.locationId, status: { in: ['waiting_sender', 'sent'] } } } }),
          tx.materialHandover.findMany({ where: { organizationId, materialId: action.handover.materialId, locationId: action.handover.locationId, status: { in: ['waiting_custodian', 'accepted'] } } }),
        ]);
        const lotQty = lots.reduce((sum, lot) => sum.plus(lot.qty), new Prisma.Decimal(0));
        const otherCustody = handovers.reduce((sum, row) => sum.plus(row.status === 'accepted' ? row.remainingQty : row.qty), new Prisma.Decimal(0));
        const protectedStock = reservations.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0)).plus(transfers.reduce((sum, row) => sum.plus(row.qty), new Prisma.Decimal(0))).plus(otherCustody);
        if (!stock || !material || stock.qty.minus(action.qty).lessThan(protectedStock.minus(action.qty)) || material.qty.lessThan(action.qty) || lotQty.lessThan(action.qty)) throw new ConflictException('Sərfiyyat üçün sərbəst qalıq kifayət etmir və ya Stock/Material/StockLot uzlaşmır');
        let remaining = action.qty;
        for (const lot of lots) {
          if (!remaining.greaterThan(0)) break;
          const take = Prisma.Decimal.min(remaining, lot.qty);
          await tx.stockLot.update({ where: { id: lot.id }, data: { qty: { decrement: take } } });
          remaining = remaining.minus(take);
        }
        await tx.stock.update({ where: { id: stock.id }, data: { qty: { decrement: action.qty } } });
        await tx.material.update({ where: { id: material.id }, data: { qty: { decrement: action.qty } } });
        const movement = await tx.movement.create({ data: { organizationId, materialId: material.id, material: material.name, locationId: action.handover.locationId, type: 'mexaric', qty: action.qty, unit: action.handover.material.unit, project: action.handover.project.name, date: new Date().toISOString().slice(0, 10), by: user.name, from: `CUSTODY:${action.handoverId}:${action.id}`, note: action.reason } });
        movementId = movement.id;
      }
      const reviewedAt = new Date();
      const updatedAction = await tx.materialCustodyAction.update({ where: { id: action.id }, data: { status: decision === 'approve' ? 'approved' : 'rejected', reviewedBy: user.name, reviewedById: ctx.accountId, reviewedAt, reviewReason, movementId } });
      if (decision === 'approve') await tx.materialHandover.update({ where: { id: action.handoverId }, data: { remainingQty: { decrement: action.qty } } });
      return { before: action, after: updatedAction, movementId, decision };
    });
  }

  async cancel(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    const organizationId = this.tenant.requireOrg(ctx);
    const reason = String(body.reason || '').trim();
    if (!reason) throw new BadRequestException('Ləğv səbəbini yazın');
    if (!['direktor', 'anbardar'].includes(ctx.seat || '') && !['director', 'warehouse'].includes(user.role)) throw new ForbiddenException('Təhvili yalnız direktor və anbar məsulu ləğv edə bilər');
    return this.transition(organizationId, ctx.accountId, user, id, 'material-handover-cancel', { ...body, reason }, async (tx) => {
      const row = await tx.materialHandover.findFirst({ where: { id, organizationId } });
      if (!row) throw new NotFoundException('Təhvil sənədi tapılmadı');
      if (row.status !== 'waiting_custodian') throw new ConflictException('Qəbul edilmiş təhvil ləğv edilmir');
      const cancelledAt = new Date();
      const updated = await tx.materialHandover.update({ where: { id }, data: { status: 'cancelled', cancelledBy: user.name, cancelledById: user.userId, cancelledAt, cancelReason: reason } });
      return { before: row, after: updated };
    });
  }

  async reviewQueue(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    const rows = await this.prisma.materialCustodyAction.findMany({
      where: { organizationId, status: 'pending' },
      include: { handover: { include: { project: { select: { id: true, name: true } }, location: { select: { name: true } }, material: { select: { name: true, unit: true } }, custodian: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    const assigned = await this.prisma.projectAssignment.findMany({ where: { organizationId, accountId: ctx.accountId, active: true, canReviewMaterialUsage: true }, select: { projectId: true } });
    const reviewer = ['director', 'pm'].includes(user.role);
    return rows.filter((row) => reviewer || assigned.some((item) => item.projectId === row.handover.projectId)).map((row) => ({ id: row.id, kind: row.kind, qty: row.qty.toNumber(), status: row.status, reason: row.reason, requestedBy: row.requestedBy, requestedById: row.requestedById, createdAt: row.createdAt.toISOString(), handoverId: row.handoverId, projectId: row.handover.projectId, projectName: row.handover.project.name, locationName: row.handover.location.name, materialName: row.handover.material.name, unit: row.handover.material.unit, custodianName: row.handover.custodian.name }));
  }

  private async transition(organizationId: string, accountId: string, user: AuthUser, id: string, command: string, body: Record<string, unknown>, work: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const key = this.key(body.key);
    const payload = { ...body, key: undefined };
    const requestHash = this.hash({ id, command, payload });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) {
        if (replay.requestHash !== requestHash || replay.accountId !== accountId) throw new ConflictException('Əməliyyat açarı başqa təhvilə aiddir');
        return { id, replayed: true };
      }
      const snapshot = await work(tx);
      const at = new Date().toISOString();
      await tx.auditEntry.create({ data: { organizationId, at, actor: user.name, role: user.role, action: command, detail: JSON.stringify({ id, snapshot }) } });
      await tx.operationReceipt.create({ data: { organizationId, accountId, key, requestHash, command, changedBooks: { handoverId: id, command, snapshot } as Prisma.InputJsonValue } });
      return { id, replayed: false };
    }, 60000);
  }

  private key(value: unknown) {
    const key = String(value || '');
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new BadRequestException('Əməliyyat açarı düzgün deyil');
    return key;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
