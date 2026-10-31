import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../platform/tenant.service';
import { WarehouseReconciliationService } from './warehouse-reconciliation.service';

describe('warehouse reconciliation ledger diagnostics', () => {
  const user = { name: 'Warehouse', role: 'warehouse' } as AuthUser;

  it('nets receipts, issues and transfers by location and labels unsupported movement types', async () => {
    const prisma = {
      material: { findMany: jest.fn().mockResolvedValue([{ id: 'm1', organizationId: 'org-a', name: 'Armatur', unit: 'kg', qty: new Prisma.Decimal(15) }]) },
      stock: { groupBy: jest.fn().mockResolvedValue([
        { materialId: 'm1', locationId: 'loc-a', _sum: { qty: new Prisma.Decimal(10) } },
        { materialId: 'm1', locationId: 'loc-b', _sum: { qty: new Prisma.Decimal(5) } },
      ]), count: jest.fn().mockResolvedValue(2) },
      stockLot: { groupBy: jest.fn().mockResolvedValue([
        { materialId: 'm1', locationId: 'loc-a', _sum: { qty: new Prisma.Decimal(10) } },
        { materialId: 'm1', locationId: 'loc-b', _sum: { qty: new Prisma.Decimal(5) } },
      ]), count: jest.fn().mockResolvedValue(2) },
      movement: {
        groupBy: jest.fn().mockResolvedValue([
          { materialId: 'm1', locationId: 'loc-a', type: 'medaxil', from: null, _sum: { qty: new Prisma.Decimal(12) }, _count: { _all: 1 }, _max: { date: '2026-10-01' } },
          { materialId: 'm1', locationId: 'loc-a', type: 'mexaric', from: null, _sum: { qty: new Prisma.Decimal(2) }, _count: { _all: 1 }, _max: { date: '2026-10-02' } },
          { materialId: 'm1', locationId: 'loc-b', type: 'transfer', from: 'loc-a', _sum: { qty: new Prisma.Decimal(3) }, _count: { _all: 1 }, _max: { date: '2026-10-03' } },
          { materialId: 'm1', locationId: 'loc-a', type: 'adjustment', from: null, _sum: { qty: new Prisma.Decimal(1) }, _count: { _all: 1 }, _max: { date: '2026-10-04' } },
          { materialId: 'm1', locationId: 'loc-a', type: 'qebul', from: null, _sum: { qty: new Prisma.Decimal(4) }, _count: { _all: 1 }, _max: { date: '2026-10-05' } },
          { materialId: 'm1', locationId: 'loc-b', type: 'cixis', from: null, _sum: { qty: new Prisma.Decimal(1) }, _count: { _all: 1 }, _max: { date: '2026-10-06' } },
        ]), count: jest.fn().mockResolvedValue(6),
      },
      location: { findMany: jest.fn().mockResolvedValue([{ id: 'loc-a', name: 'Mərkəz' }, { id: 'loc-b', name: 'Sahə' }]) },
    };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-a', seat: 'anbardar' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-a') };
    const service = new WarehouseReconciliationService(prisma as unknown as PrismaService, tenant as unknown as TenantService);

    const report = await service.report(user);
    const places = report.items[0].places;
    expect(places.find((row) => row.locationId === 'loc-a')).toMatchObject({ knownNetMovementQty: 11, inferredOpeningResidualQty: -1, unsupportedMovementCount: 1 });
    expect(places.find((row) => row.locationId === 'loc-b')).toMatchObject({ knownNetMovementQty: 2, inferredOpeningResidualQty: 3 });
    expect(report.summary).toMatchObject({ movementRowCount: 6, unsupportedMovementCount: 1, legacyAliasMovementCount: 2, mismatchCount: 0 });
  });
});
