ALTER TABLE "Location" ADD COLUMN "parentId" TEXT, ADD COLUMN "responsibleAccountId" TEXT;
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_responsibleAccountId_fkey" FOREIGN KEY ("responsibleAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "WarehouseCount" ("id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "locationId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "reason" TEXT NOT NULL, "documentRef" TEXT NOT NULL, "lines" JSONB NOT NULL, "createdById" TEXT NOT NULL, "createdBy" TEXT NOT NULL, "reviewedById" TEXT, "reviewedBy" TEXT, "reviewNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3));
CREATE INDEX "WarehouseCount_organizationId_status_idx" ON "WarehouseCount"("organizationId", "status");
