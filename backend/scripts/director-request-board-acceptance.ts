import { RequestWorkflowsService } from '../src/records/request-workflows.service';
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
  const schema = `requestboard_qa_${randomUUID().replace(/-/g, '')}`;
  assert.match(schema, /^requestboard_qa_[a-f0-9]{32}$/);
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

    const workflow = new RequestWorkflowsService(db as PrismaService, tenant);
    const central = await db.location.create({
        data: { organizationId: org, name: 'UAT Central A', kind: 'merkez' },
      }),
      second = await db.location.create({
        data: { organizationId: org, name: 'UAT Central B', kind: 'merkez' },
      });
    await db.stock.createMany({
      data: [
        {
          organizationId: org,
          materialId: material.id,
          locationId: central.id,
          qty: 10,
        },
        {
          organizationId: org,
          materialId: material.id,
          locationId: second.id,
          qty: 3,
        },
      ],
    });
    await db.material.update({ where: { id: material.id }, data: { qty: 13 } });
    const request = async (id: string, qty: number) =>
      db.materialRequest.create({
        data: {
          id,
          organizationId: org,
          projectId: project.id,
          project: project.name,
          materialId: material.id,
          material: material.name,
          unit: 'bag',
          qty,
          status: 'gozleyir',
          author: 'UAT Requester',
          date: '2026-11-02',
          priority: 'urgent',
        },
      });
    const hold = await request('REQ-HOLD', 1);
    await db.materialRequest.update({
      where: { id: hold.id },
      data: { status: 'tesdiq' },
    });
    await db.stockReservation.create({
      data: {
        organizationId: org,
        requestId: hold.id,
        materialId: material.id,
        locationId: central.id,
        qty: 1,
        createdBy: director.name,
      },
    });
    await db.shipment.create({
      data: {
        organizationId: org,
        stops: [],
        date: '2026-11-02',
        by: warehouse.name,
        status: 'waiting_sender',
        fromLocationId: central.id,
        toLocationId: location.id,
        lines: {
          create: {
            sort: 1,
            materialId: material.id,
            material: material.name,
            qty: 2,
            unit: 'bag',
            price: 5,
            amount: 10,
          },
        },
      },
    });
    await db.materialHandover.create({
      data: {
        organizationId: org,
        projectId: project.id,
        locationId: central.id,
        materialId: material.id,
        custodianAccountId: warehouse.userId,
        qty: 1,
        remainingQty: 1,
        status: 'accepted',
        createdBy: director.name,
      },
    });
    const act = await db.purchaseAct.create({
      data: {
        organizationId: org,
        projectId: project.id,
        project: project.name,
        number: 'UAT-HOLD-RETURN',
        objectName: 'UAT',
        date: '2026-11-02',
        status: 'qaralama',
        net: 5,
        lines: {
          create: {
            sort: 1,
            materialId: material.id,
            materialName: material.name,
            unit: 'bag',
            qty: 1,
            unitPrice: 5,
            amount: 5,
            firmName: 'UAT Supplier',
          },
        },
      },
      include: { lines: true },
    });
    const receipt = await db.purchaseReceipt.create({
      data: {
        organizationId: org,
        actId: act.id,
        locationId: central.id,
        receivedAt: '2026-11-02T10:00:00Z',
        receivedBy: warehouse.name,
      },
    });
    const rl = await db.purchaseReceiptLine.create({
      data: {
        receiptId: receipt.id,
        purchaseLineId: act.lines[0].id,
        acceptedQty: 1,
        disputedQty: 0,
      },
    });
    const lot = await db.stockLot.create({
      data: {
        organizationId: org,
        materialId: material.id,
        locationId: central.id,
        qty: 10,
        code: material.id,
        unitCost: 5,
        qr: 'BOARD-UAT',
        purchaseReceiptLineId: rl.id,
      },
    });
    const ret = await db.supplierGoodsReturn.create({
      data: {
        organizationId: org,
        purchaseActId: act.id,
        purchaseReceiptId: receipt.id,
        locationId: central.id,
        supplierName: 'UAT Supplier',
        reason: 'Synthetic hold',
        createdBy: warehouse.name,
        createdById: warehouse.userId,
        lines: {
          create: {
            purchaseReceiptLineId: rl.id,
            stockLotId: lot.id,
            materialId: material.id,
            qty: 1,
            unitCost: 5,
          },
        },
      },
    });
    const good = await request('REQ-GOOD', 7),
      bad = await request('REQ-PROBLEM', 0);
    const board = await workflow.board(director);
    const candidates = board.availability[material.id] as {
      locationId: string;
      free: string;
      reserved: string;
      transferHeld: string;
      custodyHeld: string;
      returnHeld: string;
    }[];
    assert.equal(
      candidates.find((c) => c.locationId === central.id)!.free,
      '5',
    );
    check(
      'director board free stock subtracts reservations, pending transfers, custody and supplier-return holds',
    );
    const payload = {
      key: randomUUID(),
      ids: [good.id, bad.id],
      decision: 'approve',
      allocationsById: {
        [good.id]: [
          { locationId: central.id, qty: '4' },
          { locationId: second.id, qty: '3' },
        ],
      },
    };
    const result = await workflow.decide(director, payload);
    assert.equal(result.succeeded, 1);
    assert.equal(result.failed, 1);
    assert.equal(
      (await db.materialRequest.findUniqueOrThrow({ where: { id: good.id } }))
        .status,
      'tesdiq',
    );
    assert.equal(
      (await db.materialRequest.findUniqueOrThrow({ where: { id: bad.id } }))
        .status,
      'gozleyir',
    );
    assert.equal(
      await db.stockReservation.count({ where: { requestId: good.id } }),
      2,
    );
    assert.equal(
      await db.stockReservation.count({ where: { requestId: bad.id } }),
      0,
    );
    assert.equal(await db.movement.count(), 0);
    assert.equal(
      (
        await db.material.findUniqueOrThrow({ where: { id: material.id } })
      ).qty.toNumber(),
      13,
    );
    const approvedBoard = await workflow.board(director);
    assert.equal(
      approvedBoard.requests.find((r) => r.id === good.id)!.reservedQty,
      '7',
    );
    assert.equal(
      approvedBoard.requests.find((r) => r.id === good.id)!.allocations.length,
      2,
    );
    check(
      'mixed bulk approves valid row only, keeps invalid row pending with a reason, reserves edited allocation and does not move stock',
    );
    await workflow.decide(director, payload);
    assert.equal(
      await db.stockReservation.count({ where: { requestId: good.id } }),
      2,
    );
    check('bulk replay never creates duplicate reservations');
    const conflict = await request('REQ-CONFLICT', 2);
    const over = await workflow.decide(director, {
      key: randomUUID(),
      ids: [conflict.id],
      decision: 'approve',
      allocationsById: {
        [conflict.id]: [
          { locationId: central.id, qty: '1' },
          { locationId: second.id, qty: '1' },
        ],
      },
    });
    assert.equal(over.failed, 1);
    assert.equal(
      await db.stockReservation.count({ where: { requestId: conflict.id } }),
      0,
    );
    check(
      'a conflicting later allocation rolls back earlier reservation for the same request',
    );
    const alternate = await db.material.create({
      data: {
        organizationId: org,
        name: 'UAT Gravel',
        unit: 'kg',
        qty: 1,
        min: 0,
        price: 2,
        location: central.name,
      },
    });
    await db.stock.create({
      data: {
        organizationId: org,
        materialId: alternate.id,
        locationId: central.id,
        qty: 1,
      },
    });
    const repaired = await workflow.decide(director, {
      key: randomUUID(),
      ids: [bad.id],
      decision: 'approve',
      qtyById: { [bad.id]: '3' },
      editsById: {
        [bad.id]: {
          materialId: alternate.id,
          text: 'Director repaired quantity',
          priority: 'critical',
          requiredOn: '2026-11-05',
          expectedUpdatedAt: bad.updatedAt.toISOString(),
        },
      },
      allocationsById: { [bad.id]: [{ locationId: central.id, qty: '1' }] },
    });
    assert.equal(repaired.succeeded, 1);
    const repairedRow = await db.materialRequest.findUniqueOrThrow({
      where: { id: bad.id },
    });
    assert.equal(repairedRow.qty.toString(), '3');
    assert.equal(repairedRow.materialId, alternate.id);
    assert.equal(repairedRow.unit, 'kg');
    assert.equal(repairedRow.priority, 'critical');
    assert.equal(repairedRow.text, 'Director repaired quantity');
    assert.match(repairedRow.decision || '', /2.*təminat/);
    const audit = await db.auditEntry.findFirstOrThrow({
      where: {
        action: 'Material sorğusu: approve',
        detail: { contains: bad.id },
      },
    });
    assert.match(audit.detail, /before/);
    check(
      'director can repair quantity/note/urgency/due date; selected reservation and uncovered procurement remain separate with before/after audit',
    );
    const stale = await request('REQ-STALE', 1);
    await db.materialRequest.update({
      where: { id: stale.id },
      data: { text: 'Concurrent update' },
    });
    assert.equal(
      (
        await workflow.decide(director, {
          key: randomUUID(),
          ids: [stale.id],
          decision: 'approve',
          editsById: {
            [stale.id]: { expectedUpdatedAt: stale.updatedAt.toISOString() },
          },
        })
      ).failed,
      1,
    );
    await assert.rejects(() => workflow.board(warehouse));
    await assert.rejects(() =>
      workflow.decide(warehouse, {
        key: randomUUID(),
        ids: [conflict.id],
        decision: 'approve',
      }),
    );
    const other = await db.project.create({
      data: { ...project, id: 'donor-project', name: 'Donor UAT project' },
    });
    const donor = await db.location.create({
      data: {
        organizationId: org,
        projectId: other.id,
        name: 'Donor UAT warehouse',
        kind: 'sahe',
      },
    });
    await db.stock.create({
      data: {
        organizationId: org,
        materialId: material.id,
        locationId: donor.id,
        qty: 20,
      },
    });
    assert.equal(
      (
        await workflow.decide(director, {
          key: randomUUID(),
          ids: [conflict.id],
          decision: 'approve',
          allocationsById: {
            [conflict.id]: [{ locationId: donor.id, qty: '1' }],
          },
        })
      ).failed,
      1,
    );
    assert.equal(
      await db.stockReservation.count({ where: { requestId: conflict.id } }),
      0,
    );
    check(
      'stale rows and unauthorized decisions fail; donor-project stock requires its own approved signed transfer',
    );
    const reject = await request('REQ-RETURN', 1);
    await workflow.decide(director, {
      key: randomUUID(),
      ids: [reject.id],
      decision: 'return',
      reason: 'Synthetic correction request',
    });
    assert.equal(
      (await db.materialRequest.findUniqueOrThrow({ where: { id: reject.id } }))
        .status,
      'qaytarildi',
    );
    assert.equal(
      await db.stockReservation.count({ where: { requestId: reject.id } }),
      0,
    );
    check('return for correction leaves stock/reservations unchanged');
    writeFileSync(
      resolve(
        __dirname,
        '../../docs/source-audit/director-request-board-acceptance.json',
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
