ALTER TABLE "PurchaseActLine"
  ADD COLUMN "closedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN "payableQty" DECIMAL(14,3) NOT NULL DEFAULT 0;

ALTER TABLE "PurchaseReceiptLine"
  ADD COLUMN "replacementQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN "resolvedQty" DECIMAL(14,3) NOT NULL DEFAULT 0;

UPDATE "PurchaseActLine" l
SET "payableQty" = COALESCE((
  SELECT SUM(r."acceptedQty" - r."replacementQty")
  FROM "PurchaseReceiptLine" r
  JOIN "PurchaseReceipt" p ON p."id" = r."receiptId"
  WHERE r."purchaseLineId" = l."id" AND p."reversedAt" IS NULL
), 0);

CREATE TABLE "PurchaseDisputeResolution" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actId" TEXT NOT NULL,
  "purchaseLineId" TEXT NOT NULL,
  "sourceReceiptLineId" TEXT,
  "replacementReceiptLineId" TEXT,
  "kind" TEXT NOT NULL,
  "qty" DECIMAL(14,3) NOT NULL,
  "reason" TEXT NOT NULL,
  "proofFileIds" JSONB NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requestedBy" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "requestedAt" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TEXT,
  "reviewReason" TEXT,
  "payableId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseDisputeResolution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseDisputeResolution_organizationId_actId_status_idx"
  ON "PurchaseDisputeResolution"("organizationId", "actId", "status");
CREATE INDEX "PurchaseDisputeResolution_purchaseLineId_kind_status_idx"
  ON "PurchaseDisputeResolution"("purchaseLineId", "kind", "status");
CREATE INDEX "PurchaseDisputeResolution_sourceReceiptLineId_idx"
  ON "PurchaseDisputeResolution"("sourceReceiptLineId");
