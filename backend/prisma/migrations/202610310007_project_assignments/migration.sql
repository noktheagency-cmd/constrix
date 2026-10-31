CREATE TABLE "ProjectAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "canSendTransfers" BOOLEAN NOT NULL DEFAULT false,
  "canReceiveTransfers" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectAssignment_organizationId_accountId_projectId_key"
  ON "ProjectAssignment"("organizationId", "accountId", "projectId");
CREATE INDEX "ProjectAssignment_organizationId_projectId_active_idx"
  ON "ProjectAssignment"("organizationId", "projectId", "active");
