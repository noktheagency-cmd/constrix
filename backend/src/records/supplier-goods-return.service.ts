import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuthUser } from '../auth/auth.service';
import { TenantService } from '../platform/tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializable } from '../prisma/serializable';

type ReturnDoc = Prisma.SupplierGoodsReturnGetPayload<{ include: { lines: true } }>;

@Injectable()
export class SupplierGoodsReturnService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantService) {}

  async eligible(user: AuthUser) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'warehouse'); this.requireManager(user, ctx.seat);
    const organizationId = this.tenant.requireOrg(ctx);
    const rows = await this.prisma.purchaseReceiptLine.findMany({
      where: { acceptedQty: { gt: 0 }, receipt: { organizationId, reversedAt: null }, stockLots: { some: { organizationId, purchaseReceiptLineId: { not: null } } } },
      include: { receipt: { include: { act: { select: { id: true, number: true } }, location: { select: { id: true, name: true } } } }, purchaseLine: { select: { materialName: true, materialId: true, unit: true, firmName: true } }, stockLots: true },
      orderBy: { receipt: { createdAt: 'desc' } }, take: 500,
    });
    const held = await this.prisma.supplierGoodsReturnLine.findMany({ where: { goodsReturn: { organizationId, status: { in: ['draft', 'approved'] } } }, select: { stockLotId: true, qty: true } });
    const heldByLot = new Map<string, Prisma.Decimal>(); for (const item of held) heldByLot.set(item.stockLotId, (heldByLot.get(item.stockLotId) || new Prisma.Decimal(0)).plus(item.qty));
    return rows.flatMap((line) => line.stockLots.filter((lot) => lot.purchaseReceiptLineId === line.id && lot.qty.minus(heldByLot.get(lot.id) || 0).greaterThan(0)).map((lot) => ({ receiptLineId: line.id, receiptId: line.receiptId, actId: line.receipt.actId, actNumber: line.receipt.act.number, locationId: line.receipt.locationId, locationName: line.receipt.location.name, supplierName: line.purchaseLine.firmName || '', materialId: lot.materialId || line.purchaseLine.materialId || '', materialName: line.purchaseLine.materialName, unit: line.purchaseLine.unit, lotId: lot.id, availableQty: lot.qty.minus(heldByLot.get(lot.id) || 0).toNumber(), unitCost: lot.unitCost.toNumber() })));
  }

  async list(user: AuthUser) {
    const ctx = await this.tenant.load(user); if (['direktor', 'anbardar'].includes(ctx.seat || '')) this.tenant.allow(ctx, 'warehouse'); else this.tenant.allow(ctx, 'finance');
    const rows = await this.prisma.supplierGoodsReturn.findMany({ where: { organizationId: this.tenant.requireOrg(ctx) }, include: { purchaseAct: { select: { number: true } }, location: { select: { name: true } }, lines: { include: { purchaseReceiptLine: { include: { purchaseLine: { select: { materialName: true, unit: true } } } } } }, }, orderBy: { createdAt: 'desc' }, take: 300 });
    return rows.map((row) => ({ id: row.id, supplierName: row.supplierName, reason: row.reason, status: row.status, actNumber: row.purchaseAct.number, locationName: row.location.name, createdBy: row.createdBy, approvedBy: row.approvedBy, dispatchedBy: row.dispatchedBy, supplierRepName: row.supplierRepName, supplierDocumentRef: row.supplierDocumentRef, financeDecisionNote: row.financeDecisionNote, payableId: row.payableId, amount: row.lines.reduce((n, line) => n + line.qty.toNumber() * line.unitCost.toNumber(), 0), lines: row.lines.map((line) => ({ id: line.id, materialName: line.purchaseReceiptLine.purchaseLine.materialName, unit: line.purchaseReceiptLine.purchaseLine.unit, qty: line.qty.toNumber() })) }));
  }

  async create(user: AuthUser, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'warehouse'); this.requireManager(user, ctx.seat);
    const organizationId = this.tenant.requireOrg(ctx), id = String(body.id || randomUUID()), key = this.key(body.key), reason = String(body.reason || '').trim();
    const inputs = Array.isArray(body.lines) ? body.lines as Record<string, unknown>[] : [];
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id) || reason.length < 3 || reason.length > 500 || !inputs.length || inputs.length > 100) throw new BadRequestException('Səbəb və qaytarılacaq qəbul sətirləri tələb olunur');
    const lines = inputs.map((line) => ({ receiptLineId: String(line.receiptLineId || ''), qtyText: String(line.qty || '') })).sort((a, b) => a.receiptLineId.localeCompare(b.receiptLineId));
    if (lines.some((line) => !line.receiptLineId || !/^\d{1,11}(?:\.\d{1,3})?$/.test(line.qtyText) || !new Prisma.Decimal(line.qtyText).greaterThan(0)) || new Set(lines.map((line) => line.receiptLineId)).size !== lines.length) throw new BadRequestException('Sətirlər təkrarlanmamalı, miqdarlar müsbət və 3 rəqəm dəqiqliyində olmalıdır');
    const hash = this.hash({ id, reason, lines: lines.map((line) => [line.receiptLineId, line.qtyText]) });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) { if (replay.requestHash !== hash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı təkrarlanır'); return { id, status: 'draft', replayed: true }; }
      let common: { actId: string; receiptId: string; locationId: string; supplier: string } | null = null; const details: { receiptLineId: string; lotId: string; qty: Prisma.Decimal; unitCost: Prisma.Decimal; materialId: string }[] = [];
      for (const input of lines) {
        const receiptLine = await tx.purchaseReceiptLine.findFirst({ where: { id: input.receiptLineId, receipt: { organizationId, reversedAt: null } }, include: { receipt: { include: { act: true } }, purchaseLine: true, stockLots: true } });
        const lot = receiptLine?.stockLots.find((item) => item.purchaseReceiptLineId === receiptLine.id && item.materialId);
        if (!receiptLine || !lot || !lot.materialId || !receiptLine.purchaseLine.materialId) throw new ConflictException('Bu alış qalığı konkret qəbul partiyasına bağlı deyil; əvvəl əl ilə uzlaşdırın');
        const supplier = receiptLine.purchaseLine.firmName || '';
        if (!supplier) throw new ConflictException('Alış sətrində təchizatçı yoxdur');
        const current = { actId: receiptLine.receipt.actId, receiptId: receiptLine.receiptId, locationId: receiptLine.receipt.locationId, supplier };
        if (common && JSON.stringify(common) !== JSON.stringify(current)) throw new BadRequestException('Bir qaytarma sənədi yalnız eyni təchizatçı, alış aktı, qəbul və anbardan ola bilər'); common = current;
        const qty = new Prisma.Decimal(input.qtyText);
        const holds = await tx.supplierGoodsReturnLine.findMany({ where: { stockLotId: lot.id, goodsReturn: { status: { in: ['draft', 'approved'] } } } });
        if (qty.plus(holds.reduce((n, item) => n.plus(item.qty), new Prisma.Decimal(0))).greaterThan(lot.qty)) throw new ConflictException(`${receiptLine.purchaseLine.materialName}: qaytarma rezervi partiya qalığını aşır`);
        details.push({ receiptLineId: receiptLine.id, lotId: lot.id, qty, unitCost: lot.unitCost, materialId: lot.materialId });
      }
      if (!common) throw new BadRequestException('Sətir seçin');
      const doc = await tx.supplierGoodsReturn.create({ data: { id, organizationId, purchaseActId: common.actId, purchaseReceiptId: common.receiptId, locationId: common.locationId, supplierName: common.supplier, reason, createdBy: user.name, createdById: ctx.accountId, lines: { create: details.map((line) => ({ purchaseReceiptLineId: line.receiptLineId, stockLotId: line.lotId, materialId: line.materialId, qty: line.qty, unitCost: line.unitCost })) } } });
      await this.record(tx, organizationId, ctx.accountId, user.name, user.role, key, hash, 'supplier-goods-return-create', { id, status: doc.status });
      return { id: doc.id, status: doc.status, replayed: false };
    });
  }

  async approve(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'warehouse'); this.requireDirector(user, ctx.seat);
    return this.transition(ctx, user, id, body, 'supplier-goods-return-approve', async (tx, doc) => {
      if (doc.status !== 'draft' || doc.createdById === ctx.accountId) throw new ConflictException('Yalnız başqa əməkdaşın qaralaması direktor tərəfindən təsdiqlənir');
      await tx.supplierGoodsReturn.update({ where: { id }, data: { status: 'approved', approvedBy: user.name, approvedById: ctx.accountId, approvedAt: new Date() } }); return { status: 'approved' };
    });
  }

  async dispatch(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'warehouse'); this.requireManager(user, ctx.seat);
    return this.transition(ctx, user, id, body, 'supplier-goods-return-dispatch', async (tx, doc) => {
      if (doc.status !== 'approved' || doc.approvedById === ctx.accountId) throw new ConflictException('Təsdiqləyən şəxsdən fərqli əməkdaş təsdiqli qaytarmanı təhvil verməlidir');
      for (const line of doc.lines) {
        const lot = await tx.stockLot.findFirst({ where: { id: line.stockLotId, organizationId: doc.organizationId } });
        const stock = await tx.stock.findUnique({ where: { materialId_locationId: { materialId: line.materialId, locationId: doc.locationId } } });
        const reservations = await tx.stockReservation.findMany({ where: { organizationId: doc.organizationId, materialId: line.materialId, locationId: doc.locationId, status: 'active' } });
        const reserved = reservations.reduce((n, item) => n.plus(item.qty), new Prisma.Decimal(0));
        const priorReturns = await tx.supplierGoodsReturnLine.findMany({ where: { stockLotId: line.stockLotId, goodsReturnId: { not: doc.id }, goodsReturn: { status: { in: ['draft', 'approved'] } } } });
        const held = priorReturns.reduce((n, item) => n.plus(item.qty), new Prisma.Decimal(0));
        if (!lot || lot.qty.minus(held).lessThan(line.qty) || !stock || stock.qty.minus(reserved).lessThan(line.qty)) throw new ConflictException('Partiya/anbar qalığı rezerv və ya başqa hərəkətə görə kifayət etmir');
        await tx.stockLot.update({ where: { id: lot.id }, data: { qty: { decrement: line.qty } } });
        await tx.stock.update({ where: { materialId_locationId: { materialId: line.materialId, locationId: doc.locationId } }, data: { qty: { decrement: line.qty } } });
        await tx.material.update({ where: { id: line.materialId }, data: { qty: { decrement: line.qty } } });
        const source = await tx.purchaseReceiptLine.findUnique({ where: { id: line.purchaseReceiptLineId }, include: { purchaseLine: true } });
        await tx.movement.create({ data: { organizationId: doc.organizationId, materialId: line.materialId, material: source?.purchaseLine.materialName || 'Material', locationId: doc.locationId, type: 'mexaric', qty: line.qty, unit: source?.purchaseLine.unit || '', project: '', date: new Date().toISOString().slice(0, 10), by: user.name, from: `SUPPLIER-RETURN:${doc.id}` } });
      }
      await tx.supplierGoodsReturn.update({ where: { id }, data: { status: 'sent', dispatchedBy: user.name, dispatchedById: ctx.accountId, dispatchedAt: new Date() } }); return { status: 'sent', stockDispatched: true };
    });
  }

  async confirmSupplier(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'warehouse'); this.requireManager(user, ctx.seat);
    const supplierRepName = String(body.supplierRepName || '').trim(), supplierDocumentRef = String(body.supplierDocumentRef || '').trim();
    if (!supplierRepName || supplierRepName.length > 160 || !supplierDocumentRef || supplierDocumentRef.length > 160) throw new BadRequestException('Təchizatçı nümayəndəsi və imzalı təhvil sənədinin nömrəsi tələb olunur');
    return this.transition(ctx, user, id, { ...body, supplierRepName, supplierDocumentRef }, 'supplier-goods-return-supplier-confirm', async (tx, doc) => {
      if (doc.status !== 'sent' || doc.dispatchedById === ctx.accountId) throw new ConflictException('Təchizatçı imzasını qaytarmanı təhvil verən əməkdaşdan fərqli şəxs qeydə almalıdır');
      await tx.supplierGoodsReturn.update({ where: { id }, data: { status: 'supplier_accepted', supplierRepName, supplierDocumentRef, supplierConfirmedBy: user.name, supplierConfirmedById: ctx.accountId, supplierConfirmedAt: new Date() } }); return { status: 'supplier_accepted' };
    });
  }

  async finance(user: AuthUser, id: string, body: Record<string, unknown>) {
    const ctx = await this.tenant.load(user); this.tenant.allow(ctx, 'finance');
    if (!['direktor', 'muhasib'].includes(ctx.seat || '') && user.role !== 'director') throw new ForbiddenException('Təchizatçı krediti maliyyə təsdiqi tələb edir');
    const decision = String(body.decision || ''), note = String(body.note || '').trim();
    if (!['approve', 'reject'].includes(decision) || note.length < 3 || note.length > 500) throw new BadRequestException('Maliyyə qərarı və səbəb/qeyd tələb olunur');
    return this.transition(ctx, user, id, { ...body, decision, note }, 'supplier-goods-return-finance-review', async (tx, doc) => {
      if (doc.status !== 'supplier_accepted' || doc.supplierConfirmedById === ctx.accountId) throw new ConflictException('Maliyyə təsdiqi yalnız təchizatçı imzasından sonra, başqa əməkdaş tərəfindən edilir');
      let payableId: string | null = null;
      if (decision === 'approve') {
        const amount = doc.lines.reduce((n, line) => n.plus(line.qty.mul(line.unitCost)), new Prisma.Decimal(0)).toDecimalPlaces(2);
        const payable = await tx.payable.create({ data: { organizationId: doc.organizationId, supplier: doc.supplierName, poId: doc.purchaseActId, amount: amount.negated(), status: 'acik', date: new Date().toISOString().slice(0, 10) } }); payableId = payable.id;
      }
      const status = decision === 'approve' ? 'finance_approved' : 'finance_rejected';
      await tx.supplierGoodsReturn.update({ where: { id }, data: { status, financeReviewedBy: user.name, financeReviewedById: ctx.accountId, financeReviewedAt: new Date(), financeDecisionNote: note, payableId } }); return { status, payableId, payableCreated: Boolean(payableId) };
    });
  }

  private async transition(ctx: Awaited<ReturnType<TenantService['load']>>, user: AuthUser, id: string, body: Record<string, unknown>, command: string, work: (tx: Prisma.TransactionClient, doc: ReturnDoc) => Promise<unknown>) {
    const organizationId = this.tenant.requireOrg(ctx), key = this.key(body.key), requestHash = this.hash({ id, command, payload: { ...body, key: undefined } });
    return serializable(this.prisma, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const replay = await tx.operationReceipt.findUnique({ where: { organizationId_key: { organizationId, key } } });
      if (replay) { if (replay.requestHash !== requestHash || replay.accountId !== ctx.accountId) throw new ConflictException('Əməliyyat açarı təkrarlanır'); return { id, replayed: true }; }
      const doc = await tx.supplierGoodsReturn.findFirst({ where: { id, organizationId }, include: { lines: true } }); if (!doc) throw new NotFoundException('Təchizatçı qaytarma sənədi tapılmadı');
      const result = await work(tx, doc); await this.record(tx, organizationId, ctx.accountId, user.name, user.role, key, requestHash, command, { id, result }); return { id, replayed: false, ...result as object };
    }, 120000);
  }

  private async record(tx: Prisma.TransactionClient, organizationId: string, accountId: string, actor: string, role: string, key: string, requestHash: string, command: string, detail: unknown) {
    await tx.auditEntry.create({ data: { organizationId, at: new Date().toISOString(), actor, role, action: command, detail: JSON.stringify(detail) } });
    await tx.operationReceipt.create({ data: { organizationId, accountId, key, requestHash, command, changedBooks: detail as Prisma.InputJsonValue } });
  }
  private requireManager(user: AuthUser, seat?: string | null) { if (!['direktor', 'anbardar'].includes(seat || '') && !['director', 'warehouse'].includes(user.role)) throw new ForbiddenException('Bu addım anbar məsulu və ya direktor səlahiyyəti tələb edir'); }
  private requireDirector(user: AuthUser, seat?: string | null) { if (!['direktor'].includes(seat || '') && user.role !== 'director') throw new ForbiddenException('Təchizatçı qaytarmasını direktor təsdiqləyir'); }
  private key(value: unknown) { const key = String(value || ''); if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new BadRequestException('Əməliyyat açarı düzgün deyil'); return key; }
  private hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
}
