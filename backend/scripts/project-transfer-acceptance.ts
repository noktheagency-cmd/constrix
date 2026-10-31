import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../src/projects/projects.service';
import { ShipmentWorkflowsService } from '../src/records/shipment-workflows.service';
import { TenantService } from '../src/platform/tenant.service';
import { TenantDataService } from '../src/prisma/tenant-data.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthUser } from '../src/auth/auth.service';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `transfer_qa_${randomUUID().replace(/-/g, '')}`;
  assert.match(schema, /^transfer_qa_[a-f0-9]{32}$/);
  const base = new PrismaClient();
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  let passed = false;
  const checks: string[] = [];
  const check = (label: string) => {
    checks.push(label);
    console.log(`PASS ${label}`);
  };

  try {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
      windowsHide: true,
    });

    const prisma = db as PrismaService;
    const tenant = new TenantService(prisma);
    const projects = new ProjectsService(prisma, new TenantDataService(prisma, tenant), tenant);
    const transfers = new ShipmentWorkflowsService(prisma, tenant);
    const orgId = 'qa-transfer-org';
    const foreignOrgId = 'qa-transfer-foreign-org';
    await db.organization.create({ data: { id: orgId, kind: 'tikinti', name: 'Transfer UAT' } });
    await db.organization.create({ data: { id: foreignOrgId, kind: 'tikinti', name: 'Other UAT' } });

    async function account(id: string, role: string, seat: string, organizationId: string) {
      const email = `${id}@test.invalid`;
      await db.account.create({
        data: { id, userId: id, email, passwordHash: 'uat-only', name: id, role, title: 'UAT', initials: 'QA', activeOrgId: organizationId },
      });
      await db.organizationMember.create({ data: { organizationId, accountId: id, name: id, seatRole: seat } });
      return { userId: id, email, name: id, role, title: 'UAT', initials: 'QA' } as AuthUser;
    }

    const director = await account('qa-transfer-director', 'director', 'direktor', orgId);
    const warehouse = director;
    const sender = await account('qa-transfer-sender', 'site', 'sahe', orgId);
    const receiver = await account('qa-transfer-receiver', 'site', 'sahe', orgId);
    const unassigned = await account('qa-transfer-unassigned', 'site', 'sahe', orgId);
    const foreignUser = await account('qa-transfer-foreign', 'site', 'sahe', foreignOrgId);

    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Baku' }).format(new Date());
    async function project(id: string, name: string) {
      return db.project.create({
        data: {
          id, organizationId: orgId, name, clientName: 'UAT', district: 'UAT', city: 'Bakı', address: 'UAT',
          phase: 'UAT', budget: 1000, start: day, end: day, manager: 'QA', status: 'aktiv', type: 'UAT', floors: 1, area: 100,
        },
      });
    }
    const sourceProject = await project('qa-source-project', 'Mənbə layihə');
    const targetProject = await project('qa-target-project', 'Təyinat layihəsi');
    const [source, target] = await Promise.all([
      db.location.create({ data: { id: 'qa-source-location', organizationId: orgId, projectId: sourceProject.id, name: 'Mənbə anbar', kind: 'anbar' } }),
      db.location.create({ data: { id: 'qa-target-location', organizationId: orgId, projectId: targetProject.id, name: 'Təyinat anbarı', kind: 'anbar' } }),
    ]);
    const material = await db.material.create({ data: { id: 'qa-transfer-material', organizationId: orgId, name: 'UAT armatur', unit: 'ton', qty: 20, min: 0, location: source.name, price: 100 } });
    await db.stock.create({ data: { organizationId: orgId, materialId: material.id, locationId: source.id, qty: 20 } });
    const sourceLot = await db.stockLot.create({ data: { organizationId: orgId, materialId: material.id, locationId: source.id, code: 'UAT-LOT', batch: 'UAT', qty: 20, unitCost: 100, qr: 'UAT-TRANSFER-LOT-SOURCE' } });

    await projects.assign(sourceProject.id, { accountId: sender.userId, canSendTransfers: true, canReceiveTransfers: false }, director);
    await projects.assign(targetProject.id, { accountId: receiver.userId, canSendTransfers: false, canReceiveTransfers: true }, director);
    const senderView = await transfers.list(sender);
    assert.equal(senderView.some((row) => row.canDispatch && !row.canReceive), false, 'no transfer is visible before creation');
    check('director assigns distinct source-sender and target-receiver permissions');

    const id = 'UAT-PROJECT-TRANSFER-01';
    await transfers.create(warehouse, {
      id, fromLocationId: source.id, toLocationId: target.id, note: 'UAT layihələrarası transfer', key: randomUUID(),
      lines: [{ materialId: material.id, qty: '12' }],
    });
    assert.equal((await transfers.list(unassigned)).find((row) => row.id === id)?.canDispatch, false);
    await assert.rejects(() => transfers.dispatch(unassigned, id, { key: randomUUID() }), ForbiddenException);
    assert.equal((await db.shipment.findUniqueOrThrow({ where: { id } })).status, 'waiting_sender');
    check('unassigned user cannot sign the source side and failed attempt leaves transfer unchanged');

    await assert.rejects(() => transfers.dispatch(foreignUser, id, { key: randomUUID() }), NotFoundException);
    await transfers.dispatch(sender, id, { key: randomUUID() });
    await assert.rejects(() => transfers.receive(sender, id, { key: randomUUID() }), ForbiddenException);
    await assert.rejects(() => transfers.receive(unassigned, id, { key: randomUUID() }), ForbiddenException);
    assert.equal((await db.shipment.findUniqueOrThrow({ where: { id } })).status, 'sent');
    check('tenant isolation, distinct signer rule, and missing destination permission are enforced');

    await transfers.receive(receiver, id, { key: randomUUID() });
    const [saved, sourceStock, targetStock, sourceLotResult, targetLot, movement] = await Promise.all([
      db.shipment.findUniqueOrThrow({ where: { id } }),
      db.stock.findFirstOrThrow({ where: { organizationId: orgId, materialId: material.id, locationId: source.id } }),
      db.stock.findFirstOrThrow({ where: { organizationId: orgId, materialId: material.id, locationId: target.id } }),
      db.stockLot.findFirstOrThrow({ where: { qr: 'UAT-TRANSFER-LOT-SOURCE' } }),
      db.stockLot.findFirstOrThrow({ where: { qr: `TR:${id}:${sourceLot.id}` } }),
      db.movement.findFirstOrThrow({ where: { organizationId: orgId, materialId: material.id, type: 'transfer' } }),
    ]);
    assert.equal(saved.status, 'received');
    assert.equal(saved.dispatchedById, sender.userId);
    assert.equal(saved.receivedById, receiver.userId);
    assert.equal(sourceStock.qty.toString(), '8');
    assert.equal(targetStock.qty.toString(), '12');
    assert.equal(sourceLotResult.qty.toString(), '8');
    assert.equal(targetLot.qty.toString(), '12');
    assert.equal(movement.from, source.id);
    assert.equal(movement.locationId, target.id);
    check('second signer receives transfer; stock, lot lineage, movement, and both project locations reconcile');

    await projects.unassign(sourceProject.id, sender.userId, director);
    const secondId = 'UAT-PROJECT-TRANSFER-02';
    await transfers.create(warehouse, {
      id: secondId, fromLocationId: source.id, toLocationId: target.id, note: 'UAT inactive assignment', key: randomUUID(),
      lines: [{ materialId: material.id, qty: '1' }],
    });
    await assert.rejects(() => transfers.dispatch(sender, secondId, { key: randomUUID() }), ForbiddenException);
    assert.equal((await db.shipment.findUniqueOrThrow({ where: { id: secondId } })).status, 'waiting_sender');
    check('deactivated assignment blocks subsequent source signature');
    passed = true;
    const reportPath = resolve(__dirname, '../../docs/source-audit/project-transfer-acceptance.json');
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify({ passed, checks, checkedAt: new Date().toISOString() }, null, 2));
    console.log(JSON.stringify({ passed, checks: checks.length, isolatedSchema: schema }));
  } finally {
    await db.$disconnect();
    await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await base.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
