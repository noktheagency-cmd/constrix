import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../src/auth/auth.service';
import { ReturnablePackagingService } from '../src/records/returnable-packaging.service';
import { TenantService } from '../src/platform/tenant.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `returnpack_qa_${randomUUID().replace(/-/g, '')}`;
  assert.match(schema, /^returnpack_qa_[a-f0-9]{32}$/);
  const base = new PrismaClient(); const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const checks: string[] = []; const check = (label: string) => { checks.push(label); console.log(`PASS ${label}`); };
  try {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', resolve(__dirname, '../prisma/schema.prisma')], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe', windowsHide: true });
    const organizationId = 'qa-returnpack-org';
    await db.organization.create({ data: { id: organizationId, kind: 'tikinti', name: 'Returnable packaging UAT' } });
    const seats = new Map<string, string>();
    async function account(id: string, role: string, seat: string): Promise<AuthUser> {
      seats.set(id, seat); const email = `${id}@test.invalid`;
      await db.account.create({ data: { id, userId: id, email, passwordHash: 'uat-only', name: id, role, title: 'UAT', initials: 'QA', activeOrgId: organizationId } });
      await db.organizationMember.create({ data: { organizationId, accountId: id, name: id, seatRole: seat } });
      return { userId: id, email, name: id, role, title: 'UAT', initials: 'QA' } as AuthUser;
    }
    const warehouse = await account('qa-returnpack-warehouse', 'warehouse', 'anbardar');
    const custodian = await account('qa-returnpack-custodian', 'site', 'sahe');
    const reviewer = await account('qa-returnpack-reviewer', 'pm', 'layihe');
    const stranger = await account('qa-returnpack-stranger', 'site', 'sahe');
    const project = await db.project.create({ data: { id: 'qa-returnpack-project', organizationId, name: 'Tara UAT layihəsi', clientName: 'UAT', district: 'UAT', city: 'Bakı', address: 'UAT', phase: 'UAT', budget: 10000, start: '2026-11-01', end: '2026-11-30', manager: 'UAT', status: 'aktiv', type: 'UAT', floors: 1, area: 100 } });
    const location = await db.location.create({ data: { id: 'qa-returnpack-location', organizationId, projectId: project.id, name: 'UAT anbarı', kind: 'anbar' } });
    await db.projectAssignment.create({ data: { organizationId, accountId: custodian.userId, projectId: project.id, canHoldReturnablePackaging: true, assignedBy: warehouse.userId } });
    const tenant = {
      load: async (user: AuthUser) => ({ orgId: organizationId, accountId: user.userId, seat: seats.get(user.userId) || '' }),
      allow: () => undefined,
      requireOrg: (ctx: { orgId?: string }) => { if (!ctx.orgId) throw new Error('missing org'); return ctx.orgId; },
    } as unknown as TenantService;
    const service = new ReturnablePackagingService(db as PrismaService, tenant);
    const caseId = randomUUID(); const createKey = randomUUID();
    await service.create(warehouse, { id: caseId, key: createKey, supplierName: 'UAT Təchizatçı', packageType: 'Poddon', projectId: project.id, locationId: location.id, custodianAccountId: custodian.userId, qty: '10', dueAt: '2026-10-31', note: 'İmzalı qaimə UAT-01' });
    await assert.rejects(() => service.accept(stranger, caseId, { key: randomUUID() }), ForbiddenException);
    await service.accept(custodian, caseId, { key: randomUUID() });
    let row = (await service.list(warehouse)).find((item) => item.id === caseId)!;
    assert.equal(row.balanceQty, 10); assert.equal(row.overdue, true); assert.equal(row.acceptedBy, custodian.name);
    check('separate tare case requires assigned custodian signature and computes overdue from explicitly entered due date');

    const returnEvent = await service.reportEvent(custodian, caseId, { id: randomUUID(), key: randomUUID(), kind: 'return', qty: '3', reason: 'UAT təchizatçıya qaytarma' });
    await assert.rejects(() => service.confirmReturn(warehouse, returnEvent.id, { key: randomUUID(), supplierRepName: 'Nümayəndə' }), BadRequestException);
    await service.confirmReturn(warehouse, returnEvent.id, { key: randomUUID(), supplierRepName: 'Nümayəndə UAT', supplierDocumentRef: 'signed-return/UAT-01' });
    row = (await service.list(warehouse)).find((item) => item.id === caseId)!;
    assert.equal(row.returnedQty, 3); assert.equal(row.balanceQty, 7);
    check('return balance closes only with warehouse and supplier representative/document confirmation');

    await assert.rejects(() => service.reportEvent(custodian, caseId, { id: randomUUID(), key: randomUUID(), kind: 'loss', qty: '2', reason: 'Akt' }), BadRequestException);
    const loss = await service.reportEvent(custodian, caseId, { id: randomUUID(), key: randomUUID(), kind: 'loss', qty: '2', reason: 'UAT itki aktı', evidenceRef: 'incident/UAT-LOSS-01' });
    await service.reviewIncident(reviewer, loss.id, { key: randomUUID(), decision: 'approve', responsibilityNote: 'Akt sənədlidir; maliyyə məsuliyyəti ayrıca araşdırılır, borc yaradılmır' });
    row = (await service.list(warehouse)).find((item) => item.id === caseId)!;
    assert.equal(row.resolvedQty, 2); assert.equal(row.balanceQty, 5);
    assert.equal(await db.payable.count({ where: { organizationId } }), 0);
    assert.equal(await db.material.count({ where: { organizationId } }), 0);
    const reviewed = await db.returnablePackagingEvent.findUniqueOrThrow({ where: { id: loss.id } });
    assert.equal(reviewed.status, 'approved'); assert.equal(reviewed.responsibilityNote?.includes('borc yaradılmır'), true);
    check('loss report needs documented evidence and manager approval; balance is resolved without stock or automatic payable');

    const reportPath = resolve(__dirname, '../../docs/source-audit/returnable-packaging-acceptance.json');
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify({ passed: true, checks, checkedAt: new Date().toISOString(), migrations: ['202611010010_returnable_packaging'] }, null, 2));
    console.log(JSON.stringify({ passed: true, checks: checks.length, isolatedSchema: schema }));
  } finally {
    await db.$disconnect(); await base.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); await base.$disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
