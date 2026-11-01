CREATE TABLE "PurchaseSupplierClosure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "evidenceRef" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "closedBy" TEXT NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseSupplierClosure_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseSupplierClosure_organizationId_actId_supplier_key" ON "PurchaseSupplierClosure"("organizationId", "actId", "supplier");
CREATE INDEX "PurchaseSupplierClosure_organizationId_closedAt_idx" ON "PurchaseSupplierClosure"("organizationId", "closedAt");
ALTER TABLE "PurchaseSupplierClosure" ADD CONSTRAINT "PurchaseSupplierClosure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseSupplierClosure" ADD CONSTRAINT "PurchaseSupplierClosure_actId_fkey" FOREIGN KEY ("actId") REFERENCES "PurchaseAct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedBy" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierPayment_organizationId_supplier_date_idx" ON "SupplierPayment"("organizationId", "supplier", "date");
CREATE INDEX "SupplierPayment_organizationId_status_createdAt_idx" ON "SupplierPayment"("organizationId", "status", "createdAt");
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PayablePaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "PayablePaymentAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayablePaymentAllocation_paymentId_payableId_key" ON "PayablePaymentAllocation"("paymentId", "payableId");
CREATE INDEX "PayablePaymentAllocation_payableId_idx" ON "PayablePaymentAllocation"("payableId");
ALTER TABLE "PayablePaymentAllocation" ADD CONSTRAINT "PayablePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayablePaymentAllocation" ADD CONSTRAINT "PayablePaymentAllocation_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "Payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
