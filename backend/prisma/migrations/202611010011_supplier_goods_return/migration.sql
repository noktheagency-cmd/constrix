ALTER TABLE "StockLot" ADD COLUMN "purchaseReceiptLineId" TEXT;
CREATE INDEX "StockLot_purchaseReceiptLineId_idx" ON "StockLot"("purchaseReceiptLineId");
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_purchaseReceiptLineId_fkey" FOREIGN KEY ("purchaseReceiptLineId") REFERENCES "PurchaseReceiptLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierGoodsReturn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseActId" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "createdById" TEXT,
    "approvedBy" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "dispatchedBy" TEXT,
    "dispatchedById" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "supplierRepName" TEXT,
    "supplierDocumentRef" TEXT,
    "supplierConfirmedBy" TEXT,
    "supplierConfirmedById" TEXT,
    "supplierConfirmedAt" TIMESTAMP(3),
    "financeReviewedBy" TEXT,
    "financeReviewedById" TEXT,
    "financeReviewedAt" TIMESTAMP(3),
    "financeDecisionNote" TEXT,
    "payableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierGoodsReturn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupplierGoodsReturn_organizationId_status_createdAt_idx" ON "SupplierGoodsReturn"("organizationId", "status", "createdAt");
CREATE INDEX "SupplierGoodsReturn_organizationId_supplierName_purchaseActId_idx" ON "SupplierGoodsReturn"("organizationId", "supplierName", "purchaseActId");
ALTER TABLE "SupplierGoodsReturn" ADD CONSTRAINT "SupplierGoodsReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReturn" ADD CONSTRAINT "SupplierGoodsReturn_purchaseActId_fkey" FOREIGN KEY ("purchaseActId") REFERENCES "PurchaseAct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReturn" ADD CONSTRAINT "SupplierGoodsReturn_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReturn" ADD CONSTRAINT "SupplierGoodsReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierGoodsReturnLine" (
    "id" TEXT NOT NULL,
    "goodsReturnId" TEXT NOT NULL,
    "purchaseReceiptLineId" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    CONSTRAINT "SupplierGoodsReturnLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierGoodsReturnLine_goodsReturnId_purchaseReceiptLineId_key" ON "SupplierGoodsReturnLine"("goodsReturnId", "purchaseReceiptLineId");
CREATE INDEX "SupplierGoodsReturnLine_purchaseReceiptLineId_idx" ON "SupplierGoodsReturnLine"("purchaseReceiptLineId");
CREATE INDEX "SupplierGoodsReturnLine_stockLotId_idx" ON "SupplierGoodsReturnLine"("stockLotId");
ALTER TABLE "SupplierGoodsReturnLine" ADD CONSTRAINT "SupplierGoodsReturnLine_goodsReturnId_fkey" FOREIGN KEY ("goodsReturnId") REFERENCES "SupplierGoodsReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReturnLine" ADD CONSTRAINT "SupplierGoodsReturnLine_purchaseReceiptLineId_fkey" FOREIGN KEY ("purchaseReceiptLineId") REFERENCES "PurchaseReceiptLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReturnLine" ADD CONSTRAINT "SupplierGoodsReturnLine_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
