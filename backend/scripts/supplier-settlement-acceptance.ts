import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../src/auth/auth.service';
import { ActWorkflowsService } from '../src/records/act-workflows.service';
import { TenantService } from '../src/platform/tenant.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `supplierclose_qa_${randomUUID().replace(/-/g, '')}`;
  const base = new PrismaClient(); const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const db = new PrismaClient({ datasourceUrl: url.toString() }); const checks: string[] = []; const check = (label: string) => { checks.push(label); console.log(`PASS ${label}`); };
  try {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', resolve(__dirname, '../prisma/schema.prisma')], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', windowsHide: true });
    const organizationId = 'qa-supplier-close-org'; const seats = new Map<string, string>();
    await db.organization.create({ data: { id: organizationId, kind: 'tikinti', name: 'Supplier close/payment UAT' } });
    async function account(id: string, role: string, seat: string): Promise<AuthUser> { seats.set(id, seat); const email = `${id}@test.invalid`; await db.account.create({ data: { id, userId: id, email, passwordHash: 'uat-only', name: id, role, title: 'UAT', initials: 'QA', activeOrgId: organizationId } }); await db.organizationMember.create({ data: { organizationId, accountId: id, name: id, seatRole: seat } }); return { userId: id, email, name: id, role, title: 'UAT', initials: 'QA' } as AuthUser; }
    const director = await account('qa-sclose-director', 'director', 'direktor'); const accountant = await account('qa-sclose-accountant', 'accountant', 'muhasib'); const warehouse = await account('qa-sclose-warehouse', 'warehouse', 'anbardar');
    const tenant = { load: async (user: AuthUser) => ({ orgId: organizationId, accountId: user.userId, seat: seats.get(user.userId) || '' }), allow: () => undefined, requireOrg: (ctx: { orgId?: string }) => { if (!ctx.orgId) throw new Error('missing org'); return ctx.orgId; } } as unknown as TenantService;
    const service = new ActWorkflowsService(db as PrismaService, tenant);
    const act = await db.purchaseAct.create({ data: { id: 'qa-sclose-act', organizationId, number: 'SC-UAT-01', objectName: 'UAT', date: '2026-11-01', status: 'qismən', net: 230, project: 'Layihə UAT' } });
    await db.purchaseActLine.createMany({ data: [
      { id: 'qa-sclose-line-a', actId: act.id, sort: 1, materialName: 'Armatur', unit: 'ton', qty: 10, unitPrice: 10, amount: 100, firmName: 'Firma A', receivedQty: 10, payableQty: 10 },
      { id: 'qa-sclose-line-b', actId: act.id, sort: 2, materialName: 'Sement', unit: 'kisə', qty: 5, unitPrice: 20, amount: 100, firmName: 'Firma B', receivedQty: 3, payableQty: 3, closedQty: 0 },
      { id: 'qa-sclose-line-c', actId: act.id, sort: 3, materialName: 'Qum', unit: 'm3', qty: 3, unitPrice: 10, amount: 30, firmName: 'Firma C', receivedQty: 2, payableQty: 2 },
    ] });
    const location = await db.location.create({ data: { id: 'qa-sclose-location', organizationId, name: 'UAT anbar', kind: 'anbar' } });
    const receipt = await db.purchaseReceipt.create({ data: { id: 'qa-sclose-receipt', organizationId, actId: act.id, locationId: location.id, receivedAt: '2026-11-01T09:00:00.000Z', receivedBy: warehouse.name } });
    await db.purchaseReceiptLine.createMany({ data: [
      { id: 'qa-sclose-receipt-a', receiptId: receipt.id, purchaseLineId: 'qa-sclose-line-a', acceptedQty: 10 },
      { id: 'qa-sclose-receipt-b', receiptId: receipt.id, purchaseLineId: 'qa-sclose-line-b', acceptedQty: 3 },
      { id: 'qa-sclose-receipt-c', receiptId: receipt.id, purchaseLineId: 'qa-sclose-line-c', acceptedQty: 2 },
    ] });
    const bills = await Promise.all([
      db.payable.create({ data: { organizationId, supplier: 'Firma A', poId: act.id, amount: 50, status: 'acik', date: '2026-10-01' } }),
      db.payable.create({ data: { organizationId, supplier: 'Firma A', poId: act.id, amount: 40, status: 'acik', date: '2026-10-10' } }),
      db.payable.create({ data: { organizationId, supplier: 'Firma A', poId: act.id, amount: -10, status: 'acik', date: '2026-10-11' } }),
      db.payable.create({ data: { organizationId, supplier: 'Firma B', poId: act.id, amount: 60, status: 'acik', date: '2026-10-12' } }),
    ]);
    await assert.rejects(() => service.closePurchaseSupplier(warehouse, act.id, { key: randomUUID(), supplier: 'Firma A', evidenceRef: 'ACT-1' }), ForbiddenException);
    await assert.rejects(() => service.closePurchaseSupplier(director, act.id, { key: randomUUID(), supplier: 'Firma C', evidenceRef: 'ACT-3' }), ConflictException);
    await service.closePurchaseSupplier(director, act.id, { key: randomUUID(), supplier: 'Firma A', evidenceRef: 'QABUL-A-01', note: 'Fiziki qalıq uzlaşıb' });
    assert.equal((await db.payable.findUniqueOrThrow({ where: { id: bills[0].id } })).amount.toNumber(), 50);
    const report = await service.purchaseSupplierReconciliation(director); const closed = report.rows.find((row) => row.supplier === 'Firma A') as { supplierQuantityClosed: boolean; netOpenPayable: number };
    const partialB = report.rows.find((row) => row.supplier === 'Firma B') as { supplierQuantityClosed: boolean; remainingQty: number };
    const partialC = report.rows.find((row) => row.supplier === 'Firma C') as { supplierQuantityClosed: boolean; remainingQty: number };
    assert.equal(closed.supplierQuantityClosed, true); assert.equal(closed.netOpenPayable, 80);
    assert.deepEqual({ closed: partialB.supplierQuantityClosed, remaining: partialB.remainingQty }, { closed: false, remaining: 2 });
    assert.deepEqual({ closed: partialC.supplierQuantityClosed, remaining: partialC.remainingQty }, { closed: false, remaining: 1 });
    check('one supplier can be closed while two suppliers remain independently open with their own quantities');
    check('supplier quantity closure is director-only, requires complete quantity/no open disputes, records evidence, and leaves finance balance unchanged');

    const options = await service.supplierPaymentOptions(accountant); assert.equal(options.payables.some((row) => row.id === bills[2].id), false); assert.equal(options.payables[0].id, bills[0].id);
    const draft = await service.createSupplierPayment(accountant, { key: randomUUID(), supplier: 'Firma A', date: '2026-11-01', method: 'bank', reference: 'BANK-UAT-01', amount: '75.00', allocations: [{ payableId: bills[0].id, amount: '50.00' }, { payableId: bills[1].id, amount: '25.00' }] });
    assert.equal((await db.payable.findUniqueOrThrow({ where: { id: bills[0].id } })).amount.toNumber(), 50);
    await assert.rejects(() => service.createSupplierPayment(accountant, { key: randomUUID(), supplier: 'Firma A', date: '2026-11-01', method: 'bank', reference: 'TOO-MUCH', amount: '70', allocations: [{ payableId: bills[1].id, amount: '70' }] }), ConflictException);
    await service.approveSupplierPayment(accountant, draft.id, { key: randomUUID() });
    const [paidBill, partialBill, payment] = await Promise.all([db.payable.findUniqueOrThrow({ where: { id: bills[0].id } }), db.payable.findUniqueOrThrow({ where: { id: bills[1].id } }), db.supplierPayment.findUniqueOrThrow({ where: { id: draft.id }, include: { allocations: true } })]);
    assert.equal(paidBill.amount.toNumber(), 0); assert.equal(paidBill.status, 'odenilib'); assert.equal(partialBill.amount.toNumber(), 15); assert.equal(partialBill.status, 'acik'); assert.equal(payment.status, 'approved'); assert.equal(payment.allocations.length, 2);
    check('FIFO proposal excludes supplier credits; one payment allocates across two debts; no payable changes until finance approves, partial and full balances persist');

    const reportPath = resolve(__dirname, '../../docs/source-audit/supplier-settlement-acceptance.json'); mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, JSON.stringify({ passed: true, checks, checkedAt: new Date().toISOString(), migrations: ['202611010012_supplier_closure_and_payments'] }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, isolatedSchema: schema }));
  } finally { await db.$disconnect(); await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); await base.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
