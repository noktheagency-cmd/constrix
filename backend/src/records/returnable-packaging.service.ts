import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';

@Injectable()
export class ReturnablePackagingService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantService) {}

  async custodians(user: AuthUser, projectId: string) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'warehouse');
    const organizationId = this.tenant.requireOrg(ctx);
    if (!await this.prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } })) throw new NotFoundException('Layihə tapılmadı');
    const rows = await this.prisma.projectAssignment.findMany({ where: { organizationId, projectId, active: true, canHoldReturnablePackaging: true }, include: { account: { select: { id: true, name: true } } } });
    const members = await this.prisma.organizationMember.findMany({ where: { organizationId, accountId: { in: rows.map((row) => row.accountId) } }, select: { accountId: true, seatRole: true } });
    const seats = new Map(members.map((row) => [row.accountId, row.seatRole]));
    return rows.filter((row) => ['sahe', 'layihe'].includes(seats.get(row.accountId) || '')).map((row) => ({ accountId: row.account.id, name: row.account.name, canHoldReturnablePackaging: true, active: row.active }));
  }

  async list(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    const manager = this.canManage(user, ctx.seat);
    this.tenant.allow(ctx, manager ? 'warehouse' : 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    const rows = await this.prisma.returnablePackagingCase.findMany({
      where: { organizationId, ...(!manager ? { custodianAccountId: ctx.accountId } : {}) },
      include: {
        project: { select: { name: true } }, location: { select: { name: true } },
        custodian: { select: { name: true } }, events: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], take: 500,
    });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Baku' }).format(new Date());
    return rows.map((row) => {
      const balance = row.receivedQty.minus(row.returnedQty).minus(row.resolvedQty);
      const pendingQty = row.events.filter((event) => event.status === 'pending').reduce((sum, event) => sum.plus(event.qty), new Prisma.Decimal(0));
      const dueDate = row.dueAt.toISOString().slice(0, 10);
      return {
        id: row.id, supplierName: row.supplierName, packageType: row.packageType,
        projectId: row.projectId, projectName: row.project.name, locationId: row.locationId, locationName: row.location.name,
        custodianAccountId: row.custodianAccountId, custodianName: row.custodian.name,
        receivedQty: row.receivedQty.toNumber(), returnedQty: row.returnedQty.toNumber(), resolvedQty: row.resolvedQty.toNumber(),
        balanceQty: balance.toNumber(), pendingQty: pendingQty.toNumber(), dueAt: dueDate,
        overdue: balance.greaterThan(0) && row.status === 'open' && dueDate < today, status: row.status, note: row.note,
        createdBy: row.createdBy, acceptedBy: row.acceptedBy, acceptedAt: row.acceptedAt?.toISOString() || null,
        createdAt: row.createdAt.toISOString(),
        events: row.events.map((event) => ({ id: event.id, kind: event.kind, qty: event.qty.toNumber(), status: event.status, reason: event.reason, evidenceRef: event.evidenceRef, requestedBy: event.requestedBy, reviewedBy: event.reviewedBy, reviewedAt: event.reviewedAt?.toISOString() || null, supplierRepName: event.supplierRepName, supplierDocumentRef: event.supplierDocumentRef, warehouseReceivedBy: event.warehouseReceivedBy, responsibilityNote: event.responsibilityNote, createdAt: event.createdAt.toISOString() })),
      };
    });
  }

  async create(user: AuthUser, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    if (!this.canManage(user, ctx.seat)) throw new ForbiddenException('Tara qəbulunu yalnız direktor və anbar məsulu yarada bilər');
    const organizationId = this.tenant.requireOrg(ctx);
    const supplierName = String(body.supplierName || '').trim();
    const packageType = String(body.packageType || '').trim();
    const projectId = String(body.projectId || '').trim();
    const locationId = String(body.locationId || '').trim();
    const custodianAccountId = String(body.custodianAccountId || '').trim();
    const dueText = String(body.dueAt || '').trim();
    const qtyText = String(body.qty || '').trim();
    const note = String(body.note || '').trim();
    const id = String(body.id || randomUUID());
    const key = this.key(body.key);
    const dueDate = new Date(`${dueText}T00:00:00.000Z`);
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id) || !supplierName || supplierName.length > 200 || !packageType || packageType.length > 120 || !projectId || !locationId || !custodianAccountId || !/^\d{1,11}(?:\.\d{1,3})?$/.test(qtyText) || !new Prisma.Decimal(qtyText).greaterThan(0) || !/^\d{4}-\d{2}-\d{2}$/.test(dueText) || Number.isNaN(dueDate.getTime()) || dueDate.toISOString().slice(0, 10) !== dueText) throw new BadRequestException('Təchizatçı, tara növü, layihə/anbar, məsul şəxs, müsbət miqdar və son tarix tələb olunur');
    if (note.length > 500) throw new BadRequestException('Qeyd 500 simvoldan çox ola bilməz');
    const qty = new Prisma.Decimal(qtyText);
    const requestHash = this.hash({ id, supplierName, packageType, projectId, locationId, custodianAccountId, dueText, qty: qty.toString(), note });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) { if (replay.requestHash !== requestHash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı başqa tara sənədinə aiddir'); return { id, status: 'waiting_custodian', replayed: true }; }
      const [project, location, member, assignment] = await Promise.all([
        tx.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } }),
        tx.location.findFirst({ where: { id: locationId, organizationId, projectId }, select: { id: true } }),
        tx.organizationMember.findFirst({ where: { organizationId, accountId: custodianAccountId }, select: { seatRole: true } }),
        tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId, accountId: custodianAccountId, projectId } } }),
      ]);
      if (!project || !location || !member) throw new NotFoundException('Layihə/anbar və ya şirkət üzvü tapılmadı');
      if (!['sahe', 'layihe'].includes(member.seatRole) || !assignment?.active || !assignment.canHoldReturnablePackaging) throw new ForbiddenException('Tara məsuluna bu layihə üzrə aktiv səlahiyyət verilməyib');
      const row = await tx.returnablePackagingCase.create({ data: { id, organizationId, supplierName, packageType, projectId, locationId, custodianAccountId, receivedQty: qty, dueAt: dueDate, note, createdBy: user.name, createdById: ctx.accountId } });
      const detail = { caseId: row.id, supplierName, packageType, projectId, locationId, custodianAccountId, qty: qty.toString(), dueAt: dueText, status: row.status };
      await tx.auditEntry.create({ data: { organizationId, at: new Date().toISOString(), actor: user.name, role: user.role, action: 'Qaytarılan tara qəbul üçün yaradıldı', detail: JSON.stringify(detail) } });
      await tx.operationReceipt.create({ data: { organizationId, accountId: ctx.accountId, key, requestHash, command: 'returnable-packaging-create', changedBooks: detail as Prisma.InputJsonValue } });
      return { id: row.id, status: row.status, replayed: false };
    });
  }

  async accept(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    return this.transition(organizationId, ctx.accountId, user, id, 'returnable-packaging-accept', body, async (tx) => {
      const row = await tx.returnablePackagingCase.findFirst({ where: { id, organizationId } });
      if (!row) throw new NotFoundException('Tara sənədi tapılmadı');
      if (row.custodianAccountId !== ctx.accountId || row.status !== 'waiting_custodian') throw new ForbiddenException('Qəbulu yalnız təyin edilmiş tara məsulu imzalaya bilər');
      if (row.createdById && row.createdById === ctx.accountId) throw new ForbiddenException('Təhvil verən və qəbul edən fərqli istifadəçi olmalıdır');
      const assignment = await tx.projectAssignment.findUnique({ where: { organizationId_accountId_projectId: { organizationId, accountId: ctx.accountId, projectId: row.projectId } } });
      if (!assignment?.active || !assignment.canHoldReturnablePackaging) throw new ForbiddenException('Tara üzrə layihə təyinatı aktiv deyil');
      const updated = await tx.returnablePackagingCase.update({ where: { id }, data: { status: 'open', acceptedBy: user.name, acceptedById: ctx.accountId, acceptedAt: new Date() } });
      return { before: row, after: updated };
    });
  }

  async reportEvent(user: AuthUser, caseId: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    const kind = String(body.kind || ''); const qtyText = String(body.qty || '');
    const reason = String(body.reason || '').trim(); const evidenceRef = String(body.evidenceRef || '').trim();
    const id = String(body.id || randomUUID()); const key = this.key(body.key);
    if (!['return', 'loss', 'damage'].includes(kind) || !/^[a-zA-Z0-9_-]{8,80}$/.test(id) || !/^\d{1,11}(?:\.\d{1,3})?$/.test(qtyText) || !new Prisma.Decimal(qtyText).greaterThan(0) || !reason || reason.length > 500 || (kind !== 'return' && !evidenceRef)) throw new BadRequestException('Hərəkət növü, miqdar və səbəb tələb olunur; itki/zədə üçün akt və ya sübut istinadı məcburidir');
    const qty = new Prisma.Decimal(qtyText); const requestHash = this.hash({ caseId, id, kind, qty: qty.toString(), reason, evidenceRef });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) { if (replay.requestHash !== requestHash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı başqa tara hərəkətinə aiddir'); return { id, status: 'pending', replayed: true }; }
      const row = await tx.returnablePackagingCase.findFirst({ where: { id: caseId, organizationId } });
      if (!row) throw new NotFoundException('Tara sənədi tapılmadı');
      if (row.custodianAccountId !== ctx.accountId || row.status !== 'open') throw new ForbiddenException('Tara hərəkətini yalnız açıq qalığın təyin edilmiş məsulu yarada bilər');
      const pending = await tx.returnablePackagingEvent.findMany({ where: { organizationId, caseId, status: 'pending' } });
      const pendingQty = pending.reduce((sum, event) => sum.plus(event.qty), new Prisma.Decimal(0));
      const balance = row.receivedQty.minus(row.returnedQty).minus(row.resolvedQty);
      if (pendingQty.plus(qty).greaterThan(balance)) throw new ConflictException(`Sorğu miqdarı açıq tara qalığını keçir: ${balance.toString()}`);
      const event = await tx.returnablePackagingEvent.create({ data: { id, organizationId, caseId, kind, qty, reason, evidenceRef, requestedBy: user.name, requestedById: ctx.accountId } });
      const detail = { caseId, eventId: event.id, kind, qty: qty.toString(), reason, evidenceRef, status: event.status };
      await tx.auditEntry.create({ data: { organizationId, at: new Date().toISOString(), actor: user.name, role: user.role, action: `Tara ${kind} aktı təsdiq üçün göndərildi`, detail: JSON.stringify(detail) } });
      await tx.operationReceipt.create({ data: { organizationId, accountId: ctx.accountId, key, requestHash, command: 'returnable-packaging-event', changedBooks: detail as Prisma.InputJsonValue } });
      return { id: event.id, status: event.status, replayed: false };
    });
  }

  async confirmReturn(user: AuthUser, eventId: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'warehouse');
    if (!this.canManage(user, ctx.seat)) throw new ForbiddenException('Tara qaytarmasını yalnız direktor və anbar məsulu bağlaya bilər');
    const organizationId = this.tenant.requireOrg(ctx);
    const supplierRepName = String(body.supplierRepName || '').trim(); const supplierDocumentRef = String(body.supplierDocumentRef || '').trim();
    if (!supplierRepName || supplierRepName.length > 160 || !supplierDocumentRef || supplierDocumentRef.length > 500) throw new BadRequestException('Təchizatçı nümayəndəsi və imzalı qaytarma sənədinin istinadı tələb olunur');
    return this.transition(organizationId, ctx.accountId, user, eventId, 'returnable-packaging-supplier-confirm', { ...body, supplierRepName, supplierDocumentRef }, async (tx) => {
      const event = await tx.returnablePackagingEvent.findFirst({ where: { id: eventId, organizationId }, include: { packagingCase: true } });
      if (!event) throw new NotFoundException('Tara qaytarma sorğusu tapılmadı');
      if (event.kind !== 'return' || event.status !== 'pending') throw new ConflictException('Yalnız gözləyən tara qaytarma sorğusu bağlana bilər');
      if (event.requestedById === ctx.accountId) throw new ForbiddenException('Qaytarmanı sorğulayan eyni şəxs anbar qəbul imzası ata bilməz');
      const balance = event.packagingCase.receivedQty.minus(event.packagingCase.returnedQty).minus(event.packagingCase.resolvedQty);
      if (event.qty.greaterThan(balance)) throw new ConflictException('Qaytarma miqdarı açıq tara qalığından çoxdur');
      const at = new Date();
      const updatedEvent = await tx.returnablePackagingEvent.update({ where: { id: event.id }, data: { status: 'returned', supplierRepName, supplierDocumentRef, warehouseReceivedBy: user.name, warehouseReceivedById: ctx.accountId, warehouseReceivedAt: at } });
      const returnedQty = event.packagingCase.returnedQty.plus(event.qty);
      const close = returnedQty.plus(event.packagingCase.resolvedQty).greaterThanOrEqualTo(event.packagingCase.receivedQty);
      const updatedCase = await tx.returnablePackagingCase.update({ where: { id: event.caseId }, data: { returnedQty, status: close ? 'closed' : 'open' } });
      return { before: event, after: updatedEvent, caseAfter: updatedCase };
    });
  }

  async reviewIncident(user: AuthUser, eventId: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'weather');
    const organizationId = this.tenant.requireOrg(ctx);
    if (!['director', 'pm'].includes(user.role)) throw new ForbiddenException('İtki və zədə aktını direktor və ya layihə rəhbəri təsdiqləyir');
    const decision = String(body.decision || ''); const responsibilityNote = String(body.responsibilityNote || '').trim();
    if (!['approve', 'reject'].includes(decision) || (decision === 'approve' && !responsibilityNote) || responsibilityNote.length > 500) throw new BadRequestException('Akt qərarı seçin; təsdiq üçün maliyyə məsuliyyəti barədə qeyd yazın');
    return this.transition(organizationId, ctx.accountId, user, eventId, 'returnable-packaging-incident-review', { ...body, decision, responsibilityNote }, async (tx) => {
      const event = await tx.returnablePackagingEvent.findFirst({ where: { id: eventId, organizationId }, include: { packagingCase: true } });
      if (!event) throw new NotFoundException('Tara aktı tapılmadı');
      if (!['loss', 'damage'].includes(event.kind) || event.status !== 'pending' || !event.evidenceRef) throw new ConflictException('Yalnız açıq, sənədli itki/zədə aktı nəzərdən keçirilə bilər');
      if (event.requestedById === ctx.accountId) throw new ForbiddenException('Aktı yaradan şəxs onu təsdiqləyə bilməz');
      const balance = event.packagingCase.receivedQty.minus(event.packagingCase.returnedQty).minus(event.packagingCase.resolvedQty);
      if (decision === 'approve' && event.qty.greaterThan(balance)) throw new ConflictException('Akt miqdarı cari açıq qalıqdan çoxdur');
      const at = new Date();
      const updated = await tx.returnablePackagingEvent.update({ where: { id: event.id }, data: { status: decision === 'approve' ? 'approved' : 'rejected', reviewedBy: user.name, reviewedById: ctx.accountId, reviewedAt: at, responsibilityNote } });
      if (decision === 'approve') {
        const resolvedQty = event.packagingCase.resolvedQty.plus(event.qty);
        const close = resolvedQty.plus(event.packagingCase.returnedQty).greaterThanOrEqualTo(event.packagingCase.receivedQty);
        await tx.returnablePackagingCase.update({ where: { id: event.caseId }, data: { resolvedQty, status: close ? 'closed' : 'open' } });
      }
      return { before: event, after: updated, payableCreated: false };
    });
  }

  private canManage(user: AuthUser, seat?: string | null) { return ['direktor', 'anbardar'].includes(seat || '') || ['director', 'warehouse'].includes(user.role); }
  private key(value: unknown) { const key = String(value || ''); if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new BadRequestException('Əməliyyat açarı düzgün deyil'); return key; }
  private hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

  private async transition(organizationId: string, accountId: string, user: AuthUser, id: string, command: string, body: Record<string, unknown>, work: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    const key = this.key(body.key); const payload = { ...body, key: undefined };
    const requestHash = this.hash({ id, command, payload });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) { if (replay.requestHash !== requestHash || replay.accountId !== accountId) throw new ConflictException('Əməliyyat açarı başqa tara sənədinə aiddir'); return { id, replayed: true }; }
      const snapshot = await work(tx); const at = new Date().toISOString();
      await tx.auditEntry.create({ data: { organizationId, at, actor: user.name, role: user.role, action: command, detail: JSON.stringify({ id, snapshot }) } });
      await tx.operationReceipt.create({ data: { organizationId, accountId, key, requestHash, command, changedBooks: { id, command, snapshot } as Prisma.InputJsonValue } });
      return { id, replayed: false };
    });
  }
}
