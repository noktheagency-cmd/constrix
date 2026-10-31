import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { can } from '../auth/access';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../platform/tenant.service';

@Injectable()
export class WarehouseReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly tenant: TenantService) {}

  async report(user: AuthUser) {
    const ctx = await this.tenant.load(user);
    this.tenant.allow(ctx, 'warehouse');
    if (!can(user.role, 'warehouse')) throw new ForbiddenException('Bu hesabat rolunuza uyğun deyil');
    const organizationId = this.tenant.requireOrg(ctx);
    const [materials, stocks, lots, movements, locations, stockRowCount, lotRowCount, movementRowCount] = await Promise.all([
      this.prisma.material.findMany({ where: { organizationId }, orderBy: { name: 'asc' } }),
      this.prisma.stock.groupBy({ by: ['materialId', 'locationId'], where: { organizationId }, _sum: { qty: true } }),
      this.prisma.stockLot.groupBy({ by: ['materialId', 'locationId'], where: { organizationId }, _sum: { qty: true } }),
      this.prisma.movement.groupBy({ by: ['materialId', 'locationId', 'type', 'from'], where: { organizationId }, _sum: { qty: true }, _count: { _all: true }, _max: { date: true } }),
      this.prisma.location.findMany({ where: { organizationId }, select: { id: true, name: true } }),
      this.prisma.stock.count({ where: { organizationId } }),
      this.prisma.stockLot.count({ where: { organizationId } }),
      this.prisma.movement.count({ where: { organizationId } }),
    ]);

    const materialById = new Map(materials.map((row) => [row.id, row]));
    const placeById = new Map(locations.map((row) => [row.id, row.name]));
    const byMaterial = new Map<string, { stock: Prisma.Decimal; lots: Prisma.Decimal }>();
    const byPlace = new Map<string, { materialId: string; locationId: string | null; stock: Prisma.Decimal; lots: Prisma.Decimal; movements: number; lastMovement: string; netMovement: Prisma.Decimal; unsupportedMovementCount: number }>();
    let unlinkedStockQty = new Prisma.Decimal(0), unlinkedLotQty = new Prisma.Decimal(0), unlinkedMovementCount = 0;
    const decimal = (value: Prisma.Decimal | null | undefined) => value ?? new Prisma.Decimal(0);
    const materialTotals = (id: string) => {
      let row = byMaterial.get(id);
      if (!row) { row = { stock: new Prisma.Decimal(0), lots: new Prisma.Decimal(0) }; byMaterial.set(id, row); }
      return row;
    };
    const placeTotals = (materialId: string, locationId: string | null) => {
      const key = `${materialId}\u0000${locationId ?? ''}`;
      let row = byPlace.get(key);
      if (!row) { row = { materialId, locationId, stock: new Prisma.Decimal(0), lots: new Prisma.Decimal(0), movements: 0, lastMovement: '', netMovement:new Prisma.Decimal(0), unsupportedMovementCount:0 }; byPlace.set(key, row); }
      return row;
    };

    for (const row of stocks) {
      const qty = row._sum.qty ?? new Prisma.Decimal(0);
      if (!materialById.has(row.materialId)) { unlinkedStockQty = unlinkedStockQty.plus(qty); continue; }
      materialTotals(row.materialId).stock = materialTotals(row.materialId).stock.plus(qty);
      placeTotals(row.materialId, row.locationId).stock = placeTotals(row.materialId, row.locationId).stock.plus(qty);
    }
    for (const row of lots) {
      const qty = row._sum.qty ?? new Prisma.Decimal(0);
      if (!row.materialId || !materialById.has(row.materialId)) { unlinkedLotQty = unlinkedLotQty.plus(qty); continue; }
      materialTotals(row.materialId).lots = materialTotals(row.materialId).lots.plus(qty);
      placeTotals(row.materialId, row.locationId).lots = placeTotals(row.materialId, row.locationId).lots.plus(qty);
    }
    let unsupportedMovementCount=0, legacyAliasMovementCount=0;
    for (const row of movements) {
      if (!row.materialId || !materialById.has(row.materialId)) { unlinkedMovementCount += row._count._all; continue; }
      const qty=row._sum.qty??new Prisma.Decimal(0);
      const apply=(locationId:string|null,delta:Prisma.Decimal)=>{const place=placeTotals(row.materialId!,locationId);place.movements+=row._count._all;place.netMovement=place.netMovement.plus(delta);if(row._max.date&&(!place.lastMovement||row._max.date>place.lastMovement))place.lastMovement=row._max.date;};
      if(row.type==='medaxil'||row.type==='qebul') { apply(row.locationId,qty); if(row.type==='qebul')legacyAliasMovementCount+=row._count._all; }
      else if(row.type==='mexaric'||row.type==='cixis') { apply(row.locationId,qty.negated()); if(row.type==='cixis')legacyAliasMovementCount+=row._count._all; }
      else if(row.type==='transfer'){
        apply(row.locationId,qty);
        if(row.from&&placeById.has(row.from))apply(row.from,qty.negated());
        else {unsupportedMovementCount+=row._count._all;placeTotals(row.materialId,row.locationId).unsupportedMovementCount+=row._count._all;}
      }else {unsupportedMovementCount+=row._count._all;const place=placeTotals(row.materialId,row.locationId);place.movements+=row._count._all;place.unsupportedMovementCount+=row._count._all;if(row._max.date&&(!place.lastMovement||row._max.date>place.lastMovement))place.lastMovement=row._max.date;}
    }

    const items = materials.map((material) => {
      const totals = materialTotals(material.id);
      const materialQty = decimal(material.qty);
      const stockDifference = totals.stock.minus(materialQty);
      const lotDifference = totals.lots.minus(totals.stock);
      const places = [...byPlace.values()].filter((row) => row.materialId === material.id).map((row) => ({
        locationId: row.locationId,
        locationName: row.locationId ? placeById.get(row.locationId) || 'Anbar tapılmadı' : 'Anbar təyin edilməyib',
        stockQty: row.stock.toNumber(),
        lotQty: row.lots.toNumber(),
        knownNetMovementQty: row.netMovement.toNumber(),
        inferredOpeningResidualQty: row.stock.minus(row.netMovement).toNumber(),
        unsupportedMovementCount: row.unsupportedMovementCount,
        difference: row.lots.minus(row.stock).toNumber(),
        movementCount: row.movements,
        lastMovement: row.lastMovement || null,
      })).sort((a, b) => a.locationName.localeCompare(b.locationName));
      const hasDifference = !stockDifference.isZero() || !lotDifference.isZero() || places.some((place) => place.difference !== 0);
      return {
        materialId: material.id,
        materialName: material.name,
        unit: material.unit,
        materialQty: materialQty.toNumber(),
        stockQty: totals.stock.toNumber(),
        lotQty: totals.lots.toNumber(),
        stockDifference: stockDifference.toNumber(),
        lotDifference: lotDifference.toNumber(),
        hasDifference,
        places,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        materialCount: materials.length,
        stockRowCount,
        lotRowCount,
        movementRowCount,
        unsupportedMovementCount,
        legacyAliasMovementCount,
        unlinkedStockQty: unlinkedStockQty.toNumber(),
        unlinkedLotQty: unlinkedLotQty.toNumber(),
        unlinkedMovementCount,
        mismatchCount: items.filter((row) => row.hasDifference).length,
      },
      items,
    };
  }
}
