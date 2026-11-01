ALTER TABLE "ProjectAssignment"
ADD COLUMN "canHoldReturnablePackaging" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReturnablePackagingCase" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "supplierName" TEXT NOT NULL,
  "packageType" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "custodianAccountId" TEXT NOT NULL,
  "receivedQty" DECIMAL(14,3) NOT NULL,
  "returnedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "resolvedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "dueAt" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting_custodian',
  "note" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL,
  "createdById" TEXT,
  "acceptedBy" TEXT,
  "acceptedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnablePackagingCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnablePackagingCase_qty_check" CHECK ("receivedQty" > 0 AND "returnedQty" >= 0 AND "resolvedQty" >= 0 AND "returnedQty" + "resolvedQty" <= "receivedQty"),
  CONSTRAINT "ReturnablePackagingCase_status_check" CHECK ("status" IN ('waiting_custodian', 'open', 'closed')),
  CONSTRAINT "ReturnablePackagingCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReturnablePackagingCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReturnablePackagingCase_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReturnablePackagingCase_custodianAccountId_fkey" FOREIGN KEY ("custodianAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ReturnablePackagingCase_organizationId_status_dueAt_idx" ON "ReturnablePackagingCase"("organizationId", "status", "dueAt");
CREATE INDEX "ReturnablePackagingCase_organizationId_custodianAccountId_status_idx" ON "ReturnablePackagingCase"("organizationId", "custodianAccountId", "status");
CREATE INDEX "ReturnablePackagingCase_organizationId_supplierName_projectId_idx" ON "ReturnablePackagingCase"("organizationId", "supplierName", "projectId");

CREATE TABLE "ReturnablePackagingEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "qty" DECIMAL(14,3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reason" TEXT NOT NULL,
  "evidenceRef" TEXT NOT NULL DEFAULT '',
  "requestedBy" TEXT NOT NULL,
  "requestedById" TEXT,
  "reviewedBy" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "supplierRepName" TEXT,
  "supplierDocumentRef" TEXT,
  "warehouseReceivedBy" TEXT,
  "warehouseReceivedById" TEXT,
  "warehouseReceivedAt" TIMESTAMP(3),
  "responsibilityNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnablePackagingEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnablePackagingEvent_qty_check" CHECK ("qty" > 0),
  CONSTRAINT "ReturnablePackagingEvent_kind_check" CHECK ("kind" IN ('return', 'loss', 'damage')),
  CONSTRAINT "ReturnablePackagingEvent_status_check" CHECK ("status" IN ('pending', 'returned', 'approved', 'rejected')),
  CONSTRAINT "ReturnablePackagingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReturnablePackagingEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReturnablePackagingCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ReturnablePackagingEvent_organizationId_caseId_status_idx" ON "ReturnablePackagingEvent"("organizationId", "caseId", "status");
CREATE INDEX "ReturnablePackagingEvent_organizationId_status_kind_idx" ON "ReturnablePackagingEvent"("organizationId", "status", "kind");
