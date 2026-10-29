import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCtx, TenantService } from './tenant.service';

describe('source workbook isolation and pagination', () => {
  const ctx = { orgId: 'org-a', seat: 'direktor' } as TenantCtx;
  it('scopes workbook lists to the active organization', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new PlatformService({ sourceWorkbook: { findMany } } as unknown as PrismaService, { allow: jest.fn() } as unknown as TenantService);
    await service.sourceBooks(ctx, 'purchase');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a', kind: 'purchase' } }));
  });
  it('blocks unauthorized roles before listing', async () => {
    const findMany = jest.fn();
    const service = new PlatformService({ sourceWorkbook: { findMany } } as unknown as PrismaService, { allow: () => { throw new ForbiddenException(); } } as unknown as TenantService);
    await expect(service.sourceBooks(ctx, 'boq')).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
  it('hides other organizations sheets and originals', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new PlatformService({ sourceSheet: { findFirst }, sourceWorkbook: { findFirst } } as unknown as PrismaService, { allow: jest.fn() } as unknown as TenantService);
    await expect(service.sourceRows(ctx, 'foreign', '1', '')).rejects.toThrow(NotFoundException);
    await expect(service.sourceOriginal(ctx, 'foreign')).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', workbook: { organizationId: 'org-a' } } }));
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', organizationId: 'org-a' } });
  });
  it.each([10,15,20,25,50,100])('supports %s rows per page', async size => {
    const rows = Array.from({length:125}, (_,i) => ({number:i+1,cells:[]}));
    const service = new PlatformService({sourceSheet:{findFirst:jest.fn().mockResolvedValue({columns:[],rows,workbook:{kind:'boq'}})}} as unknown as PrismaService,{allow:jest.fn()} as unknown as TenantService);
    const result = await service.sourceRows(ctx,'sheet','2','',String(size));
    expect(result.rows[0].number).toBe(size+1);
    expect(result.rows.length).toBe(Math.min(size,125-size));
    expect((await service.sourceRows(ctx,'sheet','1','')).rows).toHaveLength(10);
    expect((await service.sourceRows(ctx,'sheet','1','','99999')).rows).toHaveLength(10);
  });
  it('paginates after search and preserves formula errors', async () => {
    const rows = Array.from({ length: 125 }, (_, i) => ({ number: i + 1, cells: [{ column: 'A', value: i % 2 ? 'other' : '#REF!', formula: '=broken' }] }));
    const service = new PlatformService({ sourceSheet: { findFirst: jest.fn().mockResolvedValue({ columns: ['A'], rows, workbook: { kind: 'boq' } }) } } as unknown as PrismaService, { allow: jest.fn() } as unknown as TenantService);
    const result = await service.sourceRows(ctx, 'sheet', '99', '#REF!', '50');
    expect(result.total).toBe(63); expect(result.page).toBe(2); expect(result.rows).toHaveLength(13);
    expect(result.rows[0].cells[0]).toEqual({ column: 'A', value: '#REF!', formula: '=broken' });
  });
});
