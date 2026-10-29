import { ForbiddenException } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantCtx, TenantService } from './tenant.service';

describe('market RFQ listing', () => {
  const context = { orgId: 'buyer-a' } as TenantCtx;
  it('returns only inquiries owned by the active buyer organization', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'rfq-a' }]);
    const tenant = { requireOrg: jest.fn().mockReturnValue('buyer-a') };
    const service = new PlatformService({ priceInquiry: { findMany } } as unknown as PrismaService, tenant as unknown as TenantService);
    await expect(service.marketRfqs(context)).resolves.toEqual([{ id: 'rfq-a' }]);
    expect(tenant.requireOrg).toHaveBeenCalledWith(context);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'buyer-a' }, take: 100 }));
  });
  it('does not query the database without an active organization', async () => {
    const findMany = jest.fn();
    const tenant = { requireOrg: jest.fn(() => { throw new ForbiddenException(); }) };
    const service = new PlatformService({ priceInquiry: { findMany } } as unknown as PrismaService, tenant as unknown as TenantService);
    await expect(service.marketRfqs({ orgId: null } as TenantCtx)).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
