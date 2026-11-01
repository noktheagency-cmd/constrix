import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../src/auth/auth.service';
import { ProjectMaterialPlanService } from '../src/records/project-material-plan.service';
import { ActWorkflowsService } from '../src/records/act-workflows.service';
import { SupplierGoodsReturnService } from '../src/records/supplier-goods-return.service';
import { TenantService } from '../src/platform/tenant.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `materialplan_qa_${randomUUID().replace(/-/g, '')}`;
  assert.match(schema, /^materialplan_qa_[a-f0-9]{32}$/);
  const base = new PrismaClient();
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  await base.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  const checks: string[] = [];
  const check = (label: string) => {
    checks.push(label);
    console.log(`PASS ${label}`);
  };
  try {
    execFileSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        resolve(__dirname, '../prisma/schema.prisma'),
      ],
      {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'pipe',
        windowsHide: true,
      },
    );

    const org = 'material-plan-org';
    await db.organization.create({
      data: { id: org, kind: 'tikinti', name: 'Material Plan UAT' },
    });
    async function actor(
      id: string,
      role: string,
      seat: string,
    ): Promise<AuthUser> {
      await db.account.create({
        data: {
          id,
          userId: id,
          email: id + '@test.invalid',
          name: id,
          role,
          title: 'UAT',
          initials: 'QA',
          passwordHash: 'test-only',
          activeOrgId: org,
        },
      });
      await db.organizationMember.create({
        data: { organizationId: org, accountId: id, name: id, seatRole: seat },
      });
      return {
        userId: id,
        email: id + '@test.invalid',
        name: id,
        role,
        title: 'UAT',
        initials: 'QA',
      } as AuthUser;
    }
    const planner = await actor('planner', 'pm', 'layihe'),
      director = await actor('director', 'director', 'direktor'),
      finance = await actor('finance', 'director', 'direktor'),
      warehouse = await actor('warehouse', 'warehouse', 'anbardar');
    const project = await db.project.create({
      data: {
        id: 'plan-project',
        organizationId: org,
        name: 'Material Plan UAT',
        clientName: 'UAT',
        district: 'UAT',
        city: 'Baku',
        address: 'UAT',
        phase: 'UAT',
        budget: 1000,
        start: '2026-11-01',
        end: '2026-12-01',
        manager: 'UAT',
        status: 'aktiv',
        type: 'UAT',
        floors: 1,
        area: 10,
      },
    });
    const location = await db.location.create({
      data: {
        organizationId: org,
        projectId: project.id,
        name: 'UAT warehouse',
        kind: 'sahe',
      },
    });
    const material = await db.material.create({
      data: {
        organizationId: org,
        name: 'UAT Sement',
        unit: 'bag',
        qty: 0,
        min: 0,
        price: 5,
        location: location.name,
      },
    });
    const smeta = await db.smeta.create({
      data: {
        organizationId: org,
        projectId: project.id,
        version: 1,
        status: 'tesdiq',
        lines: {
          create: [
            {
              sort: 1,
              code: 'MAT',
              name: material.name,
              kind: 'material',
              unit: 'bag',
              qty: 10,
              unitPrice: 5,
              doneQty: 0,
              billedQty: 0,
              laborHours: 0,
            },
            {
              sort: 2,
              code: 'WORK',
              name: 'Concrete work',
              kind: 'work',
              unit: 'm3',
              qty: 20,
              unitPrice: 10,
              doneQty: 0,
              billedQty: 0,
              laborHours: 0,
            },
          ],
        },
      },
      include: { lines: true },
    });
    const matLine = smeta.lines.find((l) => l.kind === 'material')!,
      workLine = smeta.lines.find((l) => l.kind === 'work')!;
    const tenant = new TenantService(db as PrismaService),
      plans = new ProjectMaterialPlanService(db as PrismaService, tenant),
      receipts = new ActWorkflowsService(db as PrismaService, tenant),
      returns = new SupplierGoodsReturnService(db as PrismaService, tenant);
    const rows = [
      {
        materialId: material.id,
        unit: 'bag',
        sourceKind: 'smeta',
        sourceRef: 'Smeta MAT',
        smetaLineId: matLine.id,
      },
      {
        materialId: material.id,
        unit: 'bag',
        sourceKind: 'engineer',
        sourceRef: 'Engineer calculation',
        smetaLineId: workLine.id,
        coefficient: '2',
      },
      {
        materialId: material.id,
        unit: 'bag',
        sourceKind: 'qrp',
        sourceRef: 'QRP row 1',
        qty: '5',
      },
    ];
    const doc = await plans.create(planner, project.id, {
      reference: 'SYNTHETIC baseline',
      lines: rows,
    });
    let report = await plans.report(warehouse, project.id);
    assert.equal(report.plan, null);
    assert.equal(await db.stock.count(), 0);
    await assert.rejects(() =>
      plans.review(planner, project.id, doc.id, {
        decision: 'approve',
        note: 'Cannot approve',
      }),
    );
    await plans.review(director, project.id, doc.id, {
      decision: 'approve',
      note: 'Independent plan review',
    });
    await plans.review(director, project.id, doc.id, {
      decision: 'approve',
      note: 'Independent plan review',
    });
    const item = async () =>
      (await plans.report(warehouse, project.id)).items.find(
        (i) => i.materialId === material.id,
      )!;
    assert.equal((await item()).planned, '55');
    assert.equal((await item()).remaining, '55');
    check(
      'smeta materials + engineer work-volume coefficients + QRP create one approved 55-unit plan without stock writes',
    );
    const act = await db.purchaseAct.create({
      data: {
        organizationId: org,
        projectId: project.id,
        project: project.name,
        number: 'UAT-PLAN-RECEIPT',
        objectName: 'UAT',
        date: '2026-11-02',
        status: 'qaralama',
        net: 275,
        lines: {
          create: {
            sort: 1,
            materialId: material.id,
            materialName: material.name,
            unit: 'bag',
            qty: 55,
            unitPrice: 5,
            amount: 275,
            firmName: 'UAT Supplier',
          },
        },
      },
      include: { lines: true },
    });
    const receive = (acceptedQty: string, disputedQty = '0') =>
      receipts.receivePurchase(warehouse, act.id, {
        key: randomUUID(),
        locationId: location.id,
        lines: [
          {
            purchaseActLineId: act.lines[0].id,
            acceptedQty,
            disputedQty,
            disputeReason: 'Synthetic disputed goods',
          },
        ],
      });
    await receive('20', '5');
    assert.equal((await item()).accepted, '20');
    assert.equal((await item()).remaining, '35');
    await receive('5');
    assert.equal((await item()).accepted, '25');
    assert.equal((await item()).remaining, '30');
    await receive('30');
    assert.equal((await item()).remaining, '0');
    assert.equal((await item()).accepted, '55');
    check(
      'real partial purchase receipt and replacement commands automatically reconcile plan; disputed goods never satisfy demand',
    );
    const extra = await db.purchaseAct.create({
      data: {
        organizationId: org,
        projectId: project.id,
        project: project.name,
        number: 'UAT-EXTRA',
        objectName: 'UAT',
        date: '2026-11-02',
        status: 'qaralama',
        net: 25,
        lines: {
          create: {
            sort: 1,
            materialId: material.id,
            materialName: material.name,
            unit: 'bag',
            qty: 5,
            unitPrice: 5,
            amount: 25,
            firmName: 'UAT Supplier',
          },
        },
      },
      include: { lines: true },
    });
    await receipts.receivePurchase(warehouse, extra.id, {
      key: randomUUID(),
      locationId: location.id,
      lines: [{ purchaseActLineId: extra.lines[0].id, acceptedQty: '5' }],
    });
    assert.equal((await item()).excess, '5');
    await receipts.reversePurchase(director, extra.id, {
      key: randomUUID(),
      reason: 'Synthetic reversal test',
    });
    assert.equal((await item()).accepted, '55');
    assert.equal((await item()).excess, '0');
    check(
      'overdelivery is shown separately; actual purchase reversal automatically reopens demand without double counting',
    );
    const eligible = await returns.eligible(warehouse);
    const r = await returns.create(warehouse, {
      key: randomUUID(),
      reason: 'Synthetic supplier return',
      lines: [
        {
          receiptLineId: eligible.find((l) => l.actId === act.id)!
            .receiptLineId,
          qty: '2',
        },
      ],
    });
    await returns.approve(director, r.id, { key: randomUUID() });
    assert.equal((await item()).remaining, '0');
    await returns.dispatch(warehouse, r.id, { key: randomUUID() });
    assert.equal((await item()).returned, '2');
    assert.equal((await item()).remaining, '2');
    await returns.confirmSupplier(director, r.id, {
      key: randomUUID(),
      supplierRepName: 'UAT Synthetic Rep',
      supplierDocumentRef: 'UAT-SYNTHETIC',
    });
    await returns.finance(finance, r.id, {
      key: randomUUID(),
      decision: 'approve',
      note: 'Synthetic finance approval',
    });
    assert.equal((await item()).remaining, '2');
    check(
      'supplier return changes remaining demand on physical dispatch, independent of later finance credit',
    );
    const custody = await db.materialHandover.create({
      data: {
        organizationId: org,
        projectId: project.id,
        locationId: location.id,
        materialId: material.id,
        custodianAccountId: warehouse.userId,
        qty: 3,
        remainingQty: 0,
        status: 'accepted',
        createdBy: director.name,
      },
    });
    await db.materialCustodyAction.create({
      data: {
        organizationId: org,
        handoverId: custody.id,
        kind: 'consume',
        qty: 3,
        status: 'approved',
        reason: 'Synthetic approved consumption fixture',
        requestedBy: warehouse.name,
      },
    });
    assert.equal((await item()).consumed, '3');
    assert.equal((await item()).remaining, '2');
    check(
      'approved consumption stays a separate indicator and does not create duplicate procurement need',
    );
    const stale = await plans.create(planner, project.id, {
      reference: 'SYNTHETIC pending revision',
      lines: rows,
    });
    await db.smetaLine.update({ where: { id: matLine.id }, data: { qty: 11 } });
    assert.equal(
      (await plans.report(warehouse, project.id)).sourceChanged,
      true,
    );
    await assert.rejects(() =>
      plans.review(director, project.id, stale.id, {
        decision: 'approve',
        note: 'Stale source must fail',
      }),
    );
    const revision = await plans.create(planner, project.id, {
      reference: 'SYNTHETIC revised baseline',
      lines: rows,
    });
    await plans.review(director, project.id, revision.id, {
      decision: 'approve',
      note: 'Revised plan approved',
    });
    assert.equal((await item()).planned, '56');
    assert.equal((await item()).remaining, '3');
    assert.equal(
      (
        await db.projectMaterialPlan.findUniqueOrThrow({
          where: { id: doc.id },
        })
      ).status,
      'superseded',
    );
    assert.equal((await plans.report(warehouse, project.id)).plans.length, 3);
    check(
      'source changes flag stale plans; approval rejects stale snapshot; revision supersedes previous baseline and retains history',
    );
    await assert.rejects(() =>
      plans.create(planner, project.id, {
        reference: 'Bad unit',
        lines: [{ ...rows[2], unit: 'ton' }],
      }),
    );
    await assert.rejects(() =>
      plans.create(planner, 'foreign-project', {
        reference: 'Foreign',
        lines: rows,
      }),
    );
    await assert.rejects(() =>
      plans.create(planner, project.id, {
        reference: 'Foreign material',
        lines: [{ ...rows[2], materialId: 'foreign' }],
      }),
    );
    await assert.rejects(() =>
      plans.create(planner, project.id, {
        reference: 'Duplicate',
        lines: [rows[2], rows[2]],
      }),
    );
    await assert.rejects(() =>
      plans.create(warehouse, project.id, {
        reference: 'Wrong role',
        lines: rows,
      }),
    );
    assert.equal((await item()).planned, '56');
    check(
      'foreign IDs, unit mismatch, duplicate source rows and unauthorized plan writes are blocked atomically',
    );

    const other = await db.project.create({
      data: { ...project, id: 'other-project', name: 'Other UAT project' },
    });
    const otherLocation = await db.location.create({
      data: {
        organizationId: org,
        projectId: other.id,
        name: 'Other UAT warehouse',
        kind: 'sahe',
      },
    });
    const otherAct = await db.purchaseAct.create({
      data: {
        organizationId: org,
        projectId: other.id,
        project: other.name,
        number: 'OTHER-PROJECT-RECEIPT',
        objectName: 'UAT',
        date: '2026-11-02',
        status: 'qaralama',
        net: 35,
        lines: {
          create: {
            sort: 1,
            materialId: material.id,
            materialName: material.name,
            unit: 'bag',
            qty: 7,
            unitPrice: 5,
            amount: 35,
            firmName: 'UAT Supplier',
          },
        },
      },
      include: { lines: true },
    });
    await receipts.receivePurchase(warehouse, otherAct.id, {
      key: randomUUID(),
      locationId: otherLocation.id,
      lines: [{ purchaseActLineId: otherAct.lines[0].id, acceptedQty: '7' }],
    });
    assert.equal((await item()).accepted, '55');
    async function transfer(
      from: string,
      to: string,
      qty: number,
      status: string,
    ) {
      await db.shipment.create({
        data: {
          organizationId: org,
          stops: [],
          step: 0,
          date: '2026-11-02',
          by: warehouse.name,
          fromLocationId: from,
          toLocationId: to,
          status,
          lines: {
            create: {
              sort: 1,
              materialId: material.id,
              material: material.name,
              qty,
              unit: 'bag',
              price: 5,
              amount: qty * 5,
            },
          },
        },
      });
    }
    await transfer(otherLocation.id, location.id, 4, 'received');
    await transfer(location.id, otherLocation.id, 1, 'received');
    await transfer(location.id, location.id, 9, 'received');
    await transfer(otherLocation.id, location.id, 50, 'sent');
    assert.equal((await item()).transferNet, '3');
    assert.equal((await item()).remaining, '0');
    const self = await plans.create(director, project.id, {
      reference: 'Self approval test',
      lines: [rows[2]],
    });
    await assert.rejects(() =>
      plans.review(director, project.id, self.id, {
        decision: 'approve',
        note: 'Self approval blocked',
      }),
    );
    const foreignOrg = await db.organization.create({
      data: { kind: 'tikinti', name: 'Foreign UAT tenant' },
    });
    const foreignMaterial = await db.material.create({
      data: {
        organizationId: foreignOrg.id,
        name: 'Foreign UAT material',
        unit: 'bag',
        qty: 0,
        min: 0,
        price: 1,
        location: 'Foreign',
      },
    });
    await assert.rejects(() =>
      plans.create(planner, project.id, {
        reference: 'Actual foreign material',
        lines: [{ ...rows[2], materialId: foreignMaterial.id }],
      }),
    );
    const foreignSmeta = await db.smeta.create({
      data: {
        organizationId: org,
        projectId: other.id,
        version: 1,
        status: 'tesdiq',
        lines: {
          create: {
            sort: 1,
            code: 'OTHER',
            name: material.name,
            kind: 'material',
            unit: 'bag',
            qty: 7,
            unitPrice: 5,
            doneQty: 0,
            billedQty: 0,
            laborHours: 0,
          },
        },
      },
      include: { lines: true },
    });
    await assert.rejects(() =>
      plans.create(planner, project.id, {
        reference: 'Wrong-project source',
        lines: [{ ...rows[0], smetaLineId: foreignSmeta.lines[0].id }],
      }),
    );
    check(
      'same material in another project stays isolated; only received cross-project transfer net affects demand; internal and sent transfers do not; self approval and actual foreign sources fail',
    );
    writeFileSync(
      resolve(
        __dirname,
        '../../docs/source-audit/project-material-plan-acceptance.json',
      ),
      JSON.stringify(
        {
          passed: true,
          checks,
          checkedAt: new Date().toISOString(),
          isolated: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
    await base.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
    await base.$disconnect();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
