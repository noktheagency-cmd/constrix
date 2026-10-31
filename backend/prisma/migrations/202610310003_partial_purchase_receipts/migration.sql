ALTER TABLE "PurchaseActLine" ADD COLUMN "receivedQty" DECIMAL(14,3) NOT NULL DEFAULT 0;

CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "receivedAt" TEXT NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "reversedAt" TEXT,
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "purchaseLineId" TEXT NOT NULL,
    "acceptedQty" DECIMAL(14,3) NOT NULL,
    "disputedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "disputeStatus" TEXT NOT NULL DEFAULT 'yoxdur',
    "note" TEXT NOT NULL DEFAULT '',
    "disputeReason" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "PurchaseReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseReceipt_organizationId_actId_createdAt_idx" ON "PurchaseReceipt"("organizationId", "actId", "createdAt");
CREATE INDEX "PurchaseReceipt_organizationId_locationId_idx" ON "PurchaseReceipt"("organizationId", "locationId");
CREATE INDEX "PurchaseReceiptLine_receiptId_idx" ON "PurchaseReceiptLine"("receiptId");
CREATE INDEX "PurchaseReceiptLine_purchaseLineId_idx" ON "PurchaseReceiptLine"("purchaseLineId");

ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_actId_fkey" FOREIGN KEY ("actId") REFERENCES "PurchaseAct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseActLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
