import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MaterialHandoverService } from '../src/records/material-handover.service';
import { TenantService } from '../src/platform/tenant.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthUser } from '../src/auth/auth.service';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `custody_qa_${randomUUID().replace(/-/g, '')}`;
  assert.match(schema, /^custody_qa_[a-f0-9]{32}$/);
  const base = new PrismaClient();
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const checks: string[] = [];
  const check = (label: string) => { checks.push(label); console.log(`PASS ${label}`); };
  try {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', resolve(__dirname, '../prisma/schema.prisma')], {
      env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', windowsHide: true,
    });

    const orgId = 'qa-custody-org';
    await db.organization.create({ data: { id: orgId, kind: 'tikinti', name: 'Custody UAT' } });
    const roles = new Map<string, string>();
    async function account(id: string, role: string, seat: string) {
      roles.set(id, seat);
      const email = `${id}@test.invalid`;
      await db.account.create({ data: { id, userId: id, email, passwordHash: 'uat-only', name: id, role, title: 'UAT', initials: 'QA', activeOrgId: orgId } });
      await db.organizationMember.create({ data: { organizationId: orgId, accountId: id, name: id, seatRole: seat } });
      return { userId: id, email, name: id, role, title: 'UAT', initials: 'QA' } as AuthUser;
    }
    const warehouse = await account('qa-custody-warehouse', 'warehouse', 'anbardar');
    const custodian = await account('qa-custody-custodian', 'site', 'sahe');
    const reviewer = await account('qa-custody-reviewer', 'site', 'layihe');
    const stranger = await account('qa-custody-stranger', 'site', 'sahe');

    const project = await db.project.create({ data: { id: 'qa-custody-project', organizationId: orgId, name: 'Custody UAT project', clientName: 'UAT', district: 'UAT', city: 'Bakı', address: 'UAT', phase: 'UAT', budget: 10000, start: '2026-11-01', end: '2026-11-30', manager: 'UAT', status: 'aktiv', type: 'UAT', floors: 1, area: 100 } });
    const location = await db.location.create({ data: { id: 'qa-custody-location', organizationId: orgId, projectId: project.id, name: 'UAT sahə anbarı', kind: 'anbar' } });
    const material = await db.material.create({ data: { id: 'qa-custody-material', organizationId: orgId, name: 'UAT sement', unit: 'kisə', qty: 12, min: 0, location: location.name, price: 10 } });
    await db.stock.create({ data: { organizationId: orgId, materialId: material.id, locationId: location.id, qty: 12 } });
    await db.stockLot.create({ data: { organizationId: orgId, materialId: material.id, locationId: location.id, code: 'UAT-CEMENT', batch: 'UAT-01', qty: 12, unitCost: 10, qr: 'UAT-CUSTODY-LOT' } });
    await db.projectAssignment.create({ data: { organizationId: orgId, accountId: custodian.userId, projectId: project.id, canHoldMaterials: true, assignedBy: warehouse.userId } });
    await db.projectAssignment.create({ data: { organizationId: orgId, accountId: reviewer.userId, projectId: project.id, canReviewMaterialUsage: true, assignedBy: warehouse.userId } });

    const tenant = {
      load: async (user: AuthUser) => ({ orgId, accountId: user.userId, seat: roles.get(user.userId) || '' }),
      allow: () => undefined,
      requireOrg: (ctx: { orgId?: string }) => { if (!ctx.orgId) throw new Error('missing org'); return ctx.orgId; },
    } as unknown as TenantService;
    const service = new MaterialHandoverService(db as PrismaService, tenant);
    const handoverId = randomUUID();
    await service.create(warehouse, { id: handoverId, key: randomUUID(), projectId: project.id, locationId: location.id, materialId: material.id, custodianAccountId: custodian.userId, qty: '10', reason: 'UAT təhvil' });
    await assert.rejects(() => service.accept(warehouse, handoverId, { key: randomUUID() }), ForbiddenException);
    await service.accept(custodian, handoverId, { key: randomUUID() });
    assert.equal((await db.materialHandover.findUniqueOrThrow({ where: { id: handoverId } })).remainingQty.toString(), '10');
    check('warehouse-to-custodian handover requires the designated recipient signature and creates a 10-unit custody balance');

    const useKey = randomUUID();
    const useBody = { id: randomUUID(), key: useKey, kind: 'consume', qty: '4', reason: 'UAT divar işi' };
    const use = await service.requestAction(custodian, handoverId, useBody);
    const useReplay = await service.requestAction(custodian, handoverId, useBody);
    assert.equal(useReplay.replayed, true);
    await assert.rejects(() => service.reviewAction(custodian, use.id, { key: randomUUID(), decision: 'approve' }), ForbiddenException);
    await assert.rejects(() => service.reviewAction(stranger, use.id, { key: randomUUID(), decision: 'approve' }), ForbiddenException);
    let currentStock = await db.stock.findFirstOrThrow({ where: { organizationId: orgId, materialId: material.id, locationId: location.id } });
    let currentLot = await db.stockLot.findUniqueOrThrow({ where: { qr: 'UAT-CUSTODY-LOT' } });
    assert.equal(currentStock.qty.toString(), '12'); assert.equal(currentLot.qty.toString(), '12');
    assert.equal((await db.materialHandover.findUniqueOrThrow({ where: { id: handoverId } })).remainingQty.toString(), '10');
    assert.equal((await service.reviewQueue(reviewer)).length, 1);
    check('consumption request is idempotent, reserves custody without changing stock, and rejects self/unauthorized approval');

    await service.reviewAction(reviewer, use.id, { key: randomUUID(), decision: 'approve' });
    currentStock = await db.stock.findFirstOrThrow({ where: { organizationId: orgId, materialId: material.id, locationId: location.id } });
    currentLot = await db.stockLot.findUniqueOrThrow({ where: { qr: 'UAT-CUSTODY-LOT' } });
    const currentMaterial = await db.material.findUniqueOrThrow({ where: { id: material.id } });
    const useMovement = await db.movement.findFirstOrThrow({ where: { organizationId: orgId, from: `CUSTODY:${handoverId}:${use.id}` } });
    assert.equal(currentStock.qty.toString(), '8'); assert.equal(currentLot.qty.toString(), '8'); assert.equal(currentMaterial.qty.toString(), '8');
    assert.equal(useMovement.qty.toString(), '4');
    assert.equal((await db.materialHandover.findUniqueOrThrow({ where: { id: handoverId } })).remainingQty.toString(), '6');
    check('designated reviewer approval atomically decreases Stock, Material, FIFO StockLot, records movement, and reduces custody balance');

    const returnAction = await service.requestAction(custodian, handoverId, { id: randomUUID(), key: randomUUID(), kind: 'return', qty: '2', reason: 'UAT artıq materialın anbara qaytarılması' });
    await service.reviewAction(reviewer, returnAction.id, { key: randomUUID(), decision: 'approve' });
    currentStock = await db.stock.findFirstOrThrow({ where: { organizationId: orgId, materialId: material.id, locationId: location.id } });
    assert.equal(currentStock.qty.toString(), '8');
    assert.equal((await db.materialHandover.findUniqueOrThrow({ where: { id: handoverId } })).remainingQty.toString(), '4');
    const rejection = await service.requestAction(custodian, handoverId, { id: randomUUID(), key: randomUUID(), kind: 'consume', qty: '1', reason: 'UAT rədd ssenarisi' });
    await assert.rejects(() => service.reviewAction(reviewer, rejection.id, { key: randomUUID(), decision: 'reject' }), BadRequestException);
    await service.reviewAction(reviewer, rejection.id, { key: randomUUID(), decision: 'reject', reason: 'Sübut əlavə edilməyib' });
    assert.equal((await db.materialHandover.findUniqueOrThrow({ where: { id: handoverId } })).remainingQty.toString(), '4');
    assert.equal((await db.materialCustodyAction.findUniqueOrThrow({ where: { id: rejection.id } })).reviewReason, 'Sübut əlavə edilməyib');
    check('approved return releases custody only; rejected action requires reason and changes neither stock nor custody balance');

    const reportPath = resolve(__dirname, '../../docs/source-audit/material-custody-acceptance.json');
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify({ passed: true, checks, checkedAt: new Date().toISOString(), migrations: ['202611010008_material_handovers', '202611010009_material_custody_actions'] }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, isolatedSchema: schema }));
  } finally {
    await db.$disconnect();
    await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await base.$disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
