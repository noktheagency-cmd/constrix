ALTER TABLE "ProjectAssignment"
  ADD COLUMN "canHoldMaterials" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MaterialHandover" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "custodianAccountId" TEXT NOT NULL,
  "qty" DECIMAL(14,3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'waiting_custodian',
  "reason" TEXT NOT NULL DEFAULT '',
  "createdBy" TEXT NOT NULL,
  "createdById" TEXT,
  "acceptedBy" TEXT,
  "acceptedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  "cancelledById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialHandover_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaterialHandover_qty_positive_check" CHECK ("qty" > 0),
  CONSTRAINT "MaterialHandover_status_check" CHECK ("status" IN ('waiting_custodian', 'accepted', 'cancelled')),
  CONSTRAINT "MaterialHandover_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MaterialHandover_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaterialHandover_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaterialHandover_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MaterialHandover_custodianAccountId_fkey" FOREIGN KEY ("custodianAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MaterialHandover_organizationId_projectId_status_idx"
  ON "MaterialHandover"("organizationId", "projectId", "status");
CREATE INDEX "MaterialHandover_organizationId_custodianAccountId_status_idx"
  ON "MaterialHandover"("organizationId", "custodianAccountId", "status");
CREATE INDEX "MaterialHandover_organizationId_materialId_locationId_status_idx"
  ON "MaterialHandover"("organizationId", "materialId", "locationId", "status");
