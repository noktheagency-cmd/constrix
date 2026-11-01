import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../src/auth/auth.service';
import { WarehouseControlService } from '../src/records/warehouse-control.service';
import { TenantService } from '../src/platform/tenant.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const schema = `warehousecount_qa_${randomUUID().replace(/-/g, '')}`;
  assert.match(schema, /^warehousecount_qa_[a-f0-9]{32}$/);
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

    const organizationId = 'count-org';
    await db.organization.create({
      data: { id: organizationId, kind: 'tikinti', name: 'Count UAT' },
    });
    const seats = new Map<string, string>();
    async function actor(id: string, seat: string): Promise<AuthUser> {
      seats.set(id, seat);
      await db.account.create({
        data: {
          id,
          userId: id,
          email: id + '@test.invalid',
          name: id,
          role: seat === 'direktor' ? 'director' : 'warehouse',
          title: 'UAT',
          initials: 'QA',
          passwordHash: 'test-only',
        },
      });
      await db.organizationMember.create({
        data: { organizationId, accountId: id, name: id, seatRole: seat },
      });
      return {
        userId: id,
        email: id + '@test.invalid',
        name: id,
        role: seat === 'direktor' ? 'director' : 'warehouse',
      } as AuthUser;
    }
    const a = await actor('director-a', 'direktor'),
      b = await actor('director-b', 'direktor'),
      w = await actor('warehouse', 'anbardar');
    const tenant = {
      load: async (u: AuthUser) => ({
        orgId: organizationId,
        accountId: u.userId,
        seat: seats.get(u.userId),
      }),
      allow: () => {},
      requireOrg: () => organizationId,
    } as unknown as TenantService;
    const service = new WarehouseControlService(db as PrismaService, tenant);
    const root = await service.location(a, {
      name: 'Root',
      kind: 'merkez',
      responsibleAccountId: w.userId,
    });
    const child = await service.location(a, {
      name: 'Site',
      kind: 'sahe',
      parentId: root.id,
      responsibleAccountId: w.userId,
    });
    await assert.rejects(() =>
      service.location(a, {
        id: root.id,
        name: 'Root',
        kind: 'merkez',
        parentId: child.id,
        responsibleAccountId: w.userId,
      }),
    );
    await assert.rejects(() =>
      service.location(w, {
        name: 'Not allowed',
        kind: 'sahe',
        responsibleAccountId: w.userId,
      }),
    );
    await assert.rejects(() =>
      service.location(a, {
        name: 'Foreign parent',
        kind: 'sahe',
        parentId: 'foreign',
        responsibleAccountId: w.userId,
      }),
    );
    await assert.rejects(() =>
      service.location(a, {
        name: 'Foreign owner',
        kind: 'sahe',
        responsibleAccountId: 'foreign',
      }),
    );
    check(
      'hierarchy supports nested locations, tenant members and rejects cycles, foreign parents/owners and warehouse administration',
    );
    const material = await db.material.create({
      data: {
        id: 'count-mat',
        organizationId,
        name: 'Sement',
        unit: 'bag',
        qty: 10,
        min: 0,
        location: child.name,
        price: 5,
      },
    });
    await db.stock.create({
      data: {
        organizationId,
        materialId: material.id,
        locationId: child.id,
        qty: 10,
      },
    });
    await db.stockLot.create({
      data: {
        organizationId,
        materialId: material.id,
        locationId: child.id,
        code: material.id,
        qty: 10,
        unitCost: 5,
        qr: 'count-test',
      },
    });
    const submit = (counted: string) =>
      service.count(w, {
        locationId: child.id,
        reason: 'Physical test count',
        documentRef: 'SYNTHETIC-UAT',
        lines: [{ materialId: material.id, counted }],
      });
    const first = await submit('8');
    assert.equal(
      (
        await db.material.findUniqueOrThrow({ where: { id: material.id } })
      ).qty.toNumber(),
      10,
    );
    await assert.rejects(() =>
      service.review(w, first.id, {
        decision: 'approve',
        note: 'Self review blocked',
      }),
    );
    await service.review(a, first.id, {
      decision: 'approve',
      note: 'Independent physical test',
    });
    await service.review(a, first.id, {
      decision: 'approve',
      note: 'Independent physical test',
    });
    assert.equal(
      (
        await db.material.findUniqueOrThrow({ where: { id: material.id } })
      ).qty.toNumber(),
      8,
    );
    assert.equal(await db.movement.count(), 1);
    assert.equal(
      (
        await db.stockLot.aggregate({ _sum: { qty: true } })
      )._sum.qty?.toNumber(),
      8,
    );
    check(
      'submission leaves stock unchanged; independent approval reduces stock/material/lots atomically; replay does not double post',
    );
    const second = await submit('11');
    await service.review(b, second.id, {
      decision: 'approve',
      note: 'Approved gain test',
    });
    assert.equal(
      (
        await db.stockLot.aggregate({ _sum: { qty: true } })
      )._sum.qty?.toNumber(),
      11,
    );
    assert.equal(await db.payable.count(), 0);
    check(
      'approved count gain creates a traceable adjustment lot and movement without payable',
    );
    const stale = await submit('10');
    await db.stock.updateMany({ data: { qty: 12 } });
    await assert.rejects(() =>
      service.review(a, stale.id, {
        decision: 'approve',
        note: 'Stale must fail',
      }),
    );
    assert.equal(
      (await db.warehouseCount.findUniqueOrThrow({ where: { id: stale.id } }))
        .status,
      'pending',
    );
    await db.stock.updateMany({ data: { qty: 11 } });
    const rejected = await submit('0');
    await service.review(a, rejected.id, {
      decision: 'reject',
      note: 'Count rejected test',
    });
    assert.equal(
      (
        await db.material.findUniqueOrThrow({ where: { id: material.id } })
      ).qty.toNumber(),
      11,
    );
    const self = await service.count(a, {
      locationId: child.id,
      reason: 'Director test count',
      documentRef: 'SYNTHETIC',
      lines: [{ materialId: material.id, counted: '9' }],
    });
    await assert.rejects(() =>
      service.review(a, self.id, {
        decision: 'approve',
        note: 'Self must fail',
      }),
    );
    await assert.rejects(() => submit('-1'));
    await assert.rejects(() => submit('1.0001'));
    check(
      'stale snapshots, self approval and invalid counts are rejected; rejection never changes stock',
    );

    await assert.rejects(() =>
      service.count(w, {
        locationId: 'foreign-location',
        reason: 'Tenant isolation',
        documentRef: 'SYNTHETIC',
        lines: [{ materialId: material.id, counted: '1' }],
      }),
    );
    await assert.rejects(() =>
      service.count(w, {
        locationId: child.id,
        reason: 'Tenant isolation',
        documentRef: 'SYNTHETIC',
        lines: [{ materialId: 'foreign-material', counted: '1' }],
      }),
    );
    const m2 = await db.material.create({
      data: {
        organizationId,
        name: 'Broken fixture',
        unit: 'bag',
        qty: 1,
        min: 0,
        location: child.name,
        price: 5,
      },
    });
    const atomic = await service.count(w, {
      locationId: child.id,
      reason: 'Atomic rollback test',
      documentRef: 'SYNTHETIC',
      lines: [
        { materialId: material.id, counted: '9' },
        { materialId: m2.id, counted: '2' },
      ],
    });
    const movementsBefore = await db.movement.count();
    await assert.rejects(() =>
      service.review(a, atomic.id, {
        decision: 'approve',
        note: 'Must rollback entire document',
      }),
    );
    assert.equal(
      (
        await db.material.findUniqueOrThrow({ where: { id: material.id } })
      ).qty.toNumber(),
      11,
    );
    assert.equal(await db.movement.count(), movementsBefore);
    const holdRequest = await db.materialRequest.create({
      data: {
        organizationId,
        projectId: 'count-test-project',
        project: 'UAT',
        materialId: material.id,
        material: material.name,
        qty: 1,
        unit: material.unit,
        status: 'tesdiq',
        author: w.name,
        date: '2026-11-02',
      },
    });
    const reservation = await db.stockReservation.create({
      data: {
        organizationId,
        requestId: holdRequest.id,
        materialId: material.id,
        locationId: child.id,
        qty: 1,
        createdBy: w.name,
      },
    });
    const heldCount = await submit('10');
    await assert.rejects(() =>
      service.review(a, heldCount.id, {
        decision: 'approve',
        note: 'Reserved stock must block',
      }),
    );
    assert.equal(
      (
        await db.material.findUniqueOrThrow({ where: { id: material.id } })
      ).qty.toNumber(),
      11,
    );
    await db.stockReservation.delete({ where: { id: reservation.id } });
    check(
      'active stock reservations prevent count adjustments without partial writes',
    );
    const zero = await submit('0');
    await service.review(a, zero.id, {
      decision: 'approve',
      note: 'Approve zero count test',
    });
    assert.equal(
      (
        await db.stockLot.aggregate({ _sum: { qty: true } })
      )._sum.qty?.toNumber(),
      0,
    );
    assert.equal(
      (
        await db.material.findUniqueOrThrow({ where: { id: material.id } })
      ).qty.toNumber(),
      0,
    );
    check(
      'cross-tenant IDs fail; a later invalid line rolls back earlier adjustments; zero count drains multiple lots exactly',
    );
    writeFileSync(
      resolve(
        __dirname,
        '../../docs/source-audit/warehouse-control-acceptance.json',
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
