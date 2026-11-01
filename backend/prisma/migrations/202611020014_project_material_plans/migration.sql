CREATE TABLE "ProjectMaterialPlan" ("id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "reference" TEXT NOT NULL, "lines" JSONB NOT NULL, "createdById" TEXT NOT NULL, "createdBy" TEXT NOT NULL, "reviewedById" TEXT, "reviewedBy" TEXT, "reviewNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3));
CREATE UNIQUE INDEX "ProjectMaterialPlan_organizationId_projectId_version_key" ON "ProjectMaterialPlan"("organizationId", "projectId", "version");
CREATE INDEX "ProjectMaterialPlan_organizationId_projectId_status_idx" ON "ProjectMaterialPlan"("organizationId", "projectId", "status");

ALTER TABLE "ProjectMaterialPlan" ADD CONSTRAINT "ProjectMaterialPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMaterialPlan" ADD CONSTRAINT "ProjectMaterialPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
