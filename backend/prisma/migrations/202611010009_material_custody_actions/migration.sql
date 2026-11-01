ALTER TABLE "ProjectAssignment"
ADD COLUMN "canReviewMaterialUsage" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MaterialHandover"
ADD COLUMN "remainingQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
UPDATE "MaterialHandover" SET "remainingQty" = "qty" WHERE "status" = 'accepted';
ALTER TABLE "MaterialHandover"
ADD CONSTRAINT "MaterialHandover_remainingQty_check" CHECK ("remainingQty" >= 0 AND "remainingQty" <= "qty");

CREATE TABLE "MaterialCustodyAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedById" TEXT,
    "reviewedBy" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialCustodyAction_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "MaterialCustodyAction"
ADD CONSTRAINT "MaterialCustodyAction_qty_positive_check" CHECK ("qty" > 0),
ADD CONSTRAINT "MaterialCustodyAction_kind_check" CHECK ("kind" IN ('consume', 'return')),
ADD CONSTRAINT "MaterialCustodyAction_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected'));

CREATE INDEX "MaterialCustodyAction_organizationId_handoverId_status_idx"
ON "MaterialCustodyAction"("organizationId", "handoverId", "status");
CREATE INDEX "MaterialCustodyAction_organizationId_requestedById_status_idx"
ON "MaterialCustodyAction"("organizationId", "requestedById", "status");

ALTER TABLE "MaterialCustodyAction"
ADD CONSTRAINT "MaterialCustodyAction_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialCustodyAction"
ADD CONSTRAINT "MaterialCustodyAction_handoverId_fkey"
FOREIGN KEY ("handoverId") REFERENCES "MaterialHandover"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
