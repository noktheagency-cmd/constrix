import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { AuthUser } from '../src/auth/auth.service';
import { SupplierGoodsReturnService } from '../src/records/supplier-goods-return.service';
import { TenantService } from '../src/platform/tenant.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `goodsreturn_qa_${randomUUID().replace(/-/g, '')}`;
  const base = new PrismaClient(); const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const db = new PrismaClient({ datasourceUrl: url.toString() }); const checks: string[] = [];
  const check = (label: string) => { checks.push(label); console.log(`PASS ${label}`); };
  try {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', resolve(__dirname, '../prisma/schema.prisma')], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', windowsHide: true });
    const organizationId = 'qa-supplier-return-org'; const seats = new Map<string, string>();
    await db.organization.create({ data: { id: organizationId, kind: 'tikinti', name: 'Supplier return UAT' } });
    async function account(id: string, role: string, seat: string): Promise<AuthUser> {
      seats.set(id, seat); const email = `${id}@test.invalid`;
      await db.account.create({ data: { id, userId: id, email, passwordHash: 'uat-only', name: id, role, title: 'UAT', initials: 'QA', activeOrgId: organizationId } });
      await db.organizationMember.create({ data: { organizationId, accountId: id, name: id, seatRole: seat } });
      return { userId: id, email, name: id, role, title: 'UAT', initials: 'QA' } as AuthUser;
    }
    const warehouse = await account('qa-sreturn-warehouse', 'warehouse', 'anbardar');
    const director = await account('qa-sreturn-director', 'director', 'direktor');
    const sender = await account('qa-sreturn-sender', 'warehouse', 'anbardar');
    const receiver = await account('qa-sreturn-receiver', 'warehouse', 'anbardar');
    const accountant = await account('qa-sreturn-accountant', 'accountant', 'muhasib');
    const tenant = { load: async (user: AuthUser) => ({ orgId: organizationId, accountId: user.userId, seat: seats.get(user.userId) || '' }), allow: () => undefined, requireOrg: (ctx: { orgId?: string }) => { if (!ctx.orgId) throw new Error('missing org'); return ctx.orgId; } } as unknown as TenantService;
    const service = new SupplierGoodsReturnService(db as PrismaService, tenant);
    const location = await db.location.create({ data: { id: 'qa-sreturn-location', organizationId, name: 'S return UAT', kind: 'anbar' } });
    const material = await db.material.create({ data: { id: 'qa-sreturn-material', organizationId, name: 'UAT sement', unit: 'kisə', qty: 10, min: 0, location: location.name, price: 12 } });
    const act = await db.purchaseAct.create({ data: { id: 'qa-sreturn-act', organizationId, number: 'SR-UAT-01', objectName: 'UAT', date: '2026-11-01', status: 'tesdiq', net: 120, project: 'UAT' } });
    const actLine = await db.purchaseActLine.create({ data: { id: 'qa-sreturn-act-line', actId: act.id, sort: 1, materialName: material.name, materialId: material.id, unit: material.unit, qty: 10, unitPrice: 12, amount: 120, firmName: 'S Return supplier', receivedQty: 10, payableQty: 10 } });
    const receipt = await db.purchaseReceipt.create({ data: { id: 'qa-sreturn-receipt', organizationId, actId: act.id, locationId: location.id, receivedAt: '2026-11-01T10:00:00.000Z', receivedBy: warehouse.name } });
    const receiptLine = await db.purchaseReceiptLine.create({ data: { id: 'qa-sreturn-receipt-line', receiptId: receipt.id, purchaseLineId: actLine.id, acceptedQty: 10 } });
    const lot = await db.stockLot.create({ data: { id: 'qa-sreturn-lot', organizationId, materialId: material.id, locationId: location.id, code: material.id, batch: 'SR-UAT-01', qty: 10, unitCost: 12, qr: 'SR-UAT-01' , purchaseReceiptLineId: receiptLine.id } });
    await db.stock.create({ data: { organizationId, materialId: material.id, locationId: location.id, qty: 10 } });
    const legacyReceipt = await db.purchaseReceipt.create({ data: { id: 'qa-sreturn-legacy-receipt', organizationId, actId: act.id, locationId: location.id, receivedAt: '2026-10-30T10:00:00.000Z', receivedBy: warehouse.name } });
    const legacyLine = await db.purchaseReceiptLine.create({ data: { id: 'qa-sreturn-legacy-line', receiptId: legacyReceipt.id, purchaseLineId: actLine.id, acceptedQty: 1 } });
    await db.stockLot.create({ data: { id: 'qa-sreturn-legacy-lot', organizationId, materialId: material.id, locationId: location.id, code: material.id, batch: 'LEGACY', qty: 1, unitCost: 12, qr: 'SR-LEGACY-UAT' } });
    const doc = await service.create(warehouse, { id: randomUUID(), key: randomUUID(), reason: 'Müştəri sifarişinin artıq qalığı', lines: [{ receiptLineId: receiptLine.id, qty: '4' }] });
    await assert.rejects(() => service.create(warehouse, { id: randomUUID(), key: randomUUID(), reason: 'Eyni partiyanın təkrar qaytarılması', lines: [{ receiptLineId: receiptLine.id, qty: '7' }] }), ConflictException);
    assert.equal((await service.eligible(warehouse)).some((line) => line.receiptLineId === legacyLine.id), false);
    await assert.rejects(() => service.create(warehouse, { id: randomUUID(), key: randomUUID(), reason: 'Əlaqəsiz legacy lot', lines: [{ receiptLineId: legacyLine.id, qty: '1' }] }), ConflictException);
    await assert.rejects(() => service.approve(warehouse, doc.id, { key: randomUUID() }), /direktor/);
    await service.approve(director, doc.id, { key: randomUUID() });
    check('legacy lots without exact receipt linkage are blocked; exact lots only, draft reservation, and independent manager approval are enforced');

    await service.dispatch(sender, doc.id, { key: randomUUID() });
    await assert.rejects(() => service.finance(accountant, doc.id, { key: randomUUID(), decision: 'approve', note: 'Maliyyə baxışı' }), ConflictException);
    await assert.rejects(() => service.confirmSupplier(sender, doc.id, { key: randomUUID(), supplierRepName: 'Təchizatçı nümayəndəsi', supplierDocumentRef: 'SIGNED-1' }), ConflictException);
    await service.confirmSupplier(receiver, doc.id, { key: randomUUID(), supplierRepName: 'Təchizatçı nümayəndəsi', supplierDocumentRef: 'SIGNED-1' });
    const afterDispatch = await Promise.all([db.stock.findUniqueOrThrow({ where: { materialId_locationId: { materialId: material.id, locationId: location.id } } }), db.stockLot.findUniqueOrThrow({ where: { id: lot.id } }), db.material.findUniqueOrThrow({ where: { id: material.id } })]);
    assert.equal(afterDispatch[0].qty.toNumber(), 6); assert.equal(afterDispatch[1].qty.toNumber(), 6); assert.equal(afterDispatch[2].qty.toNumber(), 6);
    check('warehouse dispatch reduces stock, lot, and material exactly once; separate receiver and supplier signed document are required');

    await service.finance(accountant, doc.id, { key: randomUUID(), decision: 'approve', note: 'İmzalı sənəd SR-UAT-01 yoxlanıb' });
    const payable = await db.payable.findFirstOrThrow({ where: { organizationId, poId: act.id } });
    assert.equal(payable.amount.toNumber(), -48); assert.equal(payable.status, 'acik');
    const final = await db.supplierGoodsReturn.findUniqueOrThrow({ where: { id: doc.id } }); assert.equal(final.status, 'finance_approved'); assert.equal(final.payableId, payable.id);
    assert.equal(await db.movement.count({ where: { organizationId, from: `SUPPLIER-RETURN:${doc.id}` } }), 1);
    check('only finance approval after supplier signature creates a negative open payable tied to the source purchase act');

    const reportPath = resolve(__dirname, '../../docs/source-audit/supplier-goods-return-acceptance.json');
    mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, JSON.stringify({ passed: true, checks, checkedAt: new Date().toISOString(), migrations: ['202611010011_supplier_goods_return'] }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, isolatedSchema: schema }));
  } finally { await db.$disconnect(); await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); await base.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
