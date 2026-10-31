import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { ShipmentWorkflowsService } from '../records/shipment-workflows.service';

const directorUser = { userId: 'acct-director', email: 'director@example.test', name: 'Direktor', role: 'director' as const, title: 'Direktor', initials: 'D' };
const siteUser = { userId: 'acct-site', email: 'site@example.test', name: 'Sahə nümayəndəsi', role: 'site' as const, title: 'Sahə', initials: 'S' };

describe('project transfer assignments', () => {
  it('only assigns an active same-organization project member with project-seat role', async () => {
    const tx = {
      organizationMember: { findFirst: jest.fn().mockResolvedValue({ id: 'member-site', seatRole: 'sahe' }) },
      projectAssignment: { upsert: jest.fn().mockResolvedValue({ accountId: siteUser.userId, canSendTransfers: true, canReceiveTransfers: false, active: true, assignedBy: directorUser.userId, updatedAt: new Date(), account: { name: siteUser.name, email: siteUser.email } }) },
    };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-1', accountId: directorUser.userId, seat: 'direktor' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-1'), audit: jest.fn() };
    const scope = { requireOwned: jest.fn().mockResolvedValue({ id: 'project-1' }) };
    const service = new ProjectsService(tx as never, scope as never, tenant as never);

    const result = await service.assign('project-1', { accountId: siteUser.userId, canSendTransfers: true, canReceiveTransfers: false }, directorUser);

    expect(scope.requireOwned).toHaveBeenCalledWith('project', 'project-1', 'org-1');
    expect(tx.projectAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_accountId_projectId: { organizationId: 'org-1', accountId: siteUser.userId, projectId: 'project-1' } },
      create: expect.objectContaining({ organizationId: 'org-1', projectId: 'project-1', canSendTransfers: true, canReceiveTransfers: false }),
    }));
    expect(result.canSendTransfers).toBe(true);
    expect(result.canReceiveTransfers).toBe(false);
  });

  it('rejects users without an active organization membership or a project seat', async () => {
    const member = { findFirst: jest.fn().mockResolvedValue(null) };
    const prisma = { organizationMember: member, projectAssignment: { upsert: jest.fn() } };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-1', accountId: directorUser.userId, seat: 'direktor' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-1') };
    const service = new ProjectsService(prisma as never, { requireOwned: jest.fn() } as never, tenant as never);
    await expect(service.assign('project-1', { accountId: 'outside-org', canSendTransfers: true, canReceiveTransfers: false }, directorUser)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.projectAssignment.upsert).not.toHaveBeenCalled();

    member.findFirst.mockResolvedValue({ id: 'member-warehouse', seatRole: 'anbardar' });
    await expect(service.assign('project-1', { accountId: 'acct-warehouse', canSendTransfers: true, canReceiveTransfers: false }, directorUser)).rejects.toThrow('yalnız sahə və layihə');
    expect(prisma.projectAssignment.upsert).not.toHaveBeenCalled();
  });

  it('exposes sign controls only for the assigned source and destination projects', async () => {
    const prisma = {
      shipment: { findMany: jest.fn().mockResolvedValue([{ id: 'TR-1', stops: ['L-1', 'L-2'], step: 0, date: '2026-10-31', by: 'Anbar', note: null, status: 'waiting_sender', fromLocationId: 'L-1', toLocationId: 'L-2', createdBy: 'Anbar', dispatchedBy: null, dispatchedAt: null, receivedBy: null, receivedAt: null, cancelReason: null, lines: [] }]) },
      location: { findMany: jest.fn().mockResolvedValue([{ id: 'L-1', name: 'Layihə A', projectId: 'P-1' }, { id: 'L-2', name: 'Layihə B', projectId: 'P-2' }]) },
      projectAssignment: { findMany: jest.fn().mockResolvedValue([{ projectId: 'P-1', canSendTransfers: true, canReceiveTransfers: false }]) },
    };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-1', accountId: siteUser.userId, seat: 'sahe' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-1') };
    const service = new ShipmentWorkflowsService(prisma as never, tenant as never);

    const [row] = await service.list(siteUser);

    expect(row.canDispatch).toBe(true);
    expect(row.canReceive).toBe(false);
    expect(row.valuationVisible).toBe(false);
    expect(row.fromLocationName).toBe('Layihə A');
  });

  it('blocks a project sender without send authority before changing the shipment', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      operationReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      shipment: { findFirst: jest.fn().mockResolvedValue({ id: 'TR-1', status: 'waiting_sender', fromLocationId: 'L-1', lines: [] }), update: jest.fn() },
      location: { findFirst: jest.fn().mockResolvedValue({ id: 'L-1', projectId: 'P-1' }) },
      projectAssignment: { findUnique: jest.fn().mockResolvedValue(null) },
      auditEntry: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-1', accountId: siteUser.userId, seat: 'sahe' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-1') };
    const service = new ShipmentWorkflowsService(prisma as never, tenant as never);

    await expect(service.dispatch(siteUser, 'TR-1', { key: '0123456789abcdef' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it('requires the receiving project assignment and a different signer', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      operationReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      shipment: { findFirst: jest.fn().mockResolvedValue({ id: 'TR-1', status: 'sent', fromLocationId: 'L-1', toLocationId: 'L-2', dispatchedById: 'acct-other', dispatchedBy: 'Other', lines: [] }), update: jest.fn() },
      location: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'L-1', projectId: 'P-1' }).mockResolvedValueOnce({ id: 'L-2', projectId: 'P-2' }) },
      projectAssignment: { findUnique: jest.fn().mockResolvedValue(null) },
      auditEntry: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-1', accountId: siteUser.userId, seat: 'sahe' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-1') };
    const service = new ShipmentWorkflowsService(prisma as never, tenant as never);

    await expect(service.receive(siteUser, 'TR-1', { key: '0123456789abcdef' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.projectAssignment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_accountId_projectId: { organizationId: 'org-1', accountId: siteUser.userId, projectId: 'P-2' } } }));
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it('does not let the dispatching account sign its own receipt', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      operationReceipt: { findUnique: jest.fn().mockResolvedValue(null) },
      shipment: { findFirst: jest.fn().mockResolvedValue({ id: 'TR-1', status: 'sent', dispatchedById: siteUser.userId, lines: [] }), update: jest.fn() },
      projectAssignment: { findUnique: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-1', accountId: siteUser.userId, seat: 'sahe' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-1') };
    const service = new ShipmentWorkflowsService(prisma as never, tenant as never);

    await expect(service.receive(siteUser, 'TR-1', { key: '0123456789abcdef' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.projectAssignment.findUnique).not.toHaveBeenCalled();
    expect(tx.shipment.update).not.toHaveBeenCalled();
  });

  it('moves stock and lot lineage to the target project after an authorized second signature', async () => {
    const sourceLot = { id: 'LOT-1', qty: new Prisma.Decimal(8), code: 'MAT-1', batch: 'B-1', unitCost: new Prisma.Decimal(5), expiresOn: null };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      operationReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      shipment: { findFirst: jest.fn().mockResolvedValue({ id: 'TR-2', status: 'sent', fromLocationId: 'L-1', toLocationId: 'L-2', dispatchedById: 'acct-other', dispatchedBy: 'Other', lines: [{ materialId: 'MAT-1', material: 'Armatur', qty: new Prisma.Decimal(3), unit: 'kg' }] }), update: jest.fn() },
      location: { findFirst: jest.fn().mockResolvedValueOnce({ id: 'L-1', projectId: 'P-1' }).mockResolvedValueOnce({ id: 'L-2', projectId: 'P-2' }) },
      projectAssignment: { findUnique: jest.fn().mockResolvedValue({ active: true, canReceiveTransfers: true }) },
      project: { findFirst: jest.fn().mockResolvedValue({ name: 'Layihə B' }) },
      stock: { findFirst: jest.fn().mockResolvedValue({ id: 'STOCK-1', qty: new Prisma.Decimal(8) }), update: jest.fn(), upsert: jest.fn() },
      stockReservation: { findMany: jest.fn().mockResolvedValue([]) },
      shipmentLine: { findMany: jest.fn().mockResolvedValue([]) },
      stockLot: { findMany: jest.fn().mockResolvedValue([sourceLot]), update: jest.fn(), create: jest.fn() },
      movement: { create: jest.fn() },
      auditEntry: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-1', accountId: siteUser.userId, seat: 'sahe' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-1') };
    const service = new ShipmentWorkflowsService(prisma as never, tenant as never);

    const result = await service.receive(siteUser, 'TR-2', { key: '1123456789abcdef' });

    expect(tx.stock.update).toHaveBeenCalledWith(expect.objectContaining({ data: { qty: { decrement: new Prisma.Decimal(3) } } }));
    expect(tx.stock.upsert).toHaveBeenCalled();
    expect(tx.stockLot.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'LOT-1' }, data: { qty: { decrement: new Prisma.Decimal(3) } } }));
    expect(tx.stockLot.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ locationId: 'L-2', qty: new Prisma.Decimal(3), batch: 'B-1', unitCost: new Prisma.Decimal(5), qr: 'TR:TR-2:LOT-1' }) }));
    expect(tx.movement.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 'TR-2', replayed: false });
  });
});
