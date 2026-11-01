import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../platform/tenant.service';
import { ActWorkflowsService } from './act-workflows.service';

describe('purchase supplier reconciliation', () => {
  const act = {
    id: 'act-a', number: 'PA-001', date: '2026-10-01',
    lines: [{ id: 'line-a', firmName: 'Firma A', qty: new Prisma.Decimal(10), receivedQty: new Prisma.Decimal(5), payableQty: new Prisma.Decimal(5), closedQty: new Prisma.Decimal(0) }],
    receipts: [{ lines: [{ purchaseLineId: 'line-a', acceptedQty: new Prisma.Decimal(5), replacementQty: new Prisma.Decimal(0), disputedQty: new Prisma.Decimal(2), resolvedQty: new Prisma.Decimal(0), disputeStatus: 'acıq' }] }],
  };
  const setup = (seat: string, role: string) => {
    const prisma = {
      purchaseAct: { findMany: jest.fn().mockResolvedValue([act]) },
      payable: { findMany: jest.fn().mockResolvedValue([{ id: 'pay-a', organizationId: 'org-a', poId: 'act-a', supplier: 'Firma A', amount: new Prisma.Decimal(50), status: 'acik' }]) },
      purchaseDisputeResolution: { findMany: jest.fn().mockResolvedValue([{ id: 'resolution-a', actId: 'act-a', purchaseLineId: 'line-a', qty: new Prisma.Decimal(1), status: 'pending', payableId: null }]) },
      purchaseSupplierClosure: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-a', accountId: 'account-a', seat }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-a') };
    return { prisma, service: new ActWorkflowsService(prisma as unknown as PrismaService, tenant as unknown as TenantService), user: { name: 'Test', role } as AuthUser };
  };

  it('reports per-supplier quantities, disputes, pending credits and open payable', async () => {
    const { service, user } = setup('muhasib', 'accountant');
    const report = await service.purchaseSupplierReconciliation(user);
    expect(report.rows[0]).toMatchObject({ supplier: 'Firma A', orderedQty: 10, receivedQty: 5, payableQty: 5, remainingQty: 5, openDisputedQty: 2, pendingCreditQty: 1, netOpenPayable: 50, status: 'mübahisə açıq' });
  });

  it('does not expose payable amounts to warehouse role', async () => {
    const { service, user } = setup('anbardar', 'warehouse');
    const report = await service.purchaseSupplierReconciliation(user);
    expect(report.rows[0]).not.toHaveProperty('netOpenPayable');
    expect(report.rows[0]).not.toHaveProperty('payableCount');
  });

  it('flags confirmed legacy acts without receipt links for manual reconciliation', async () => {
    const { prisma, service, user } = setup('satinalma', 'procurement');
    prisma.purchaseAct.findMany.mockResolvedValue([{
      id: 'legacy-act', number: 'PA-LEGACY', date: '2026-10-01', status: 'tesdiq',
      lines: [{ id: 'legacy-line', firmName: 'Legacy supplier', qty: new Prisma.Decimal(10), receivedQty: new Prisma.Decimal(10), payableQty: new Prisma.Decimal(10), closedQty: new Prisma.Decimal(0) }],
      receipts: [],
    }]);
    prisma.payable.findMany.mockResolvedValue([]);
    prisma.purchaseDisputeResolution.findMany.mockResolvedValue([]);
    prisma.purchaseSupplierClosure.findMany.mockResolvedValue([]);

    const report = await service.purchaseSupplierReconciliation(user);
    expect(report.rows[0]).toMatchObject({ status: 'manual uzlaşdırma tələb olunur', manualReconciliationRequired: true, remainingQty: 0 });
  });

  it('creates the credit payable only after finance approves a documented dispute', async () => {
    const source = { id: 'receipt-line-a', purchaseLineId: 'line-a', disputedQty: new Prisma.Decimal(2), resolvedQty: new Prisma.Decimal(0), disputeStatus: 'acıq' };
    const line = { id: 'line-a', actId: 'act-a', firmName: 'Firma A', qty: new Prisma.Decimal(10), amount: new Prisma.Decimal(100), receivedQty: new Prisma.Decimal(5), payableQty: new Prisma.Decimal(5), closedQty: new Prisma.Decimal(0) };
    const resolution = { id: 'resolution-a', organizationId: 'org-a', actId: 'act-a', purchaseLineId: 'line-a', sourceReceiptLineId: source.id, kind: 'credit', qty: new Prisma.Decimal(2), status: 'pending', reason: 'Qüsurlu mal' };
    const tx = {
      $executeRaw: jest.fn(),
      operationReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      purchaseDisputeResolution: { findFirst: jest.fn().mockResolvedValue(resolution), update: jest.fn() },
      purchaseActLine: { findFirst: jest.fn().mockResolvedValue(line), update: jest.fn(), findMany: jest.fn().mockResolvedValue([{ ...line, closedQty: new Prisma.Decimal(2) }]) },
      purchaseReceiptLine: { findFirst: jest.fn().mockResolvedValue(source), update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      payable: { create: jest.fn().mockResolvedValue({ id: 'credit-payable-a' }) },
      purchaseAct: { update: jest.fn() },
      auditEntry: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
    const tenant = { load: jest.fn().mockResolvedValue({ orgId: 'org-a', accountId: 'finance-a', seat: 'muhasib' }), allow: jest.fn(), requireOrg: jest.fn().mockReturnValue('org-a') };
    const service = new ActWorkflowsService(prisma as unknown as PrismaService, tenant as unknown as TenantService);

    await expect(service.reviewPurchaseDisputeResolution({ name: 'Finance', role: 'accountant' } as AuthUser, 'act-a', { key: 'credit-approval-key-001', resolutionId: resolution.id, decision: 'approve' })).resolves.toMatchObject({ status: 'approved', payableId: 'credit-payable-a' });
    expect(tx.payable.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: new Prisma.Decimal(-20), status: 'acik', poId: 'DISPUTE-CREDIT:resolution-a' }) }));
    expect(tx.purchaseReceiptLine.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resolvedQty: new Prisma.Decimal(2), disputeStatus: 'hell' }) }));
    expect(tx.purchaseActLine.update).toHaveBeenCalledWith({ where: { id: 'line-a' }, data: { closedQty: { increment: new Prisma.Decimal(2) } } });
  });
});
