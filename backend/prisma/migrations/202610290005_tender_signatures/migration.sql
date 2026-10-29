ALTER TABLE "TenderCase" ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "finalApproverId" TEXT, ADD COLUMN "submittedAt" TIMESTAMP(3), ADD COLUMN "submissionProof" TEXT;
ALTER TABLE "TenderAnalysis" ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TenderApproval" ADD COLUMN "assignedAccountId" TEXT, ADD COLUMN "signedBy" TEXT,
 ADD COLUMN "signedAt" TIMESTAMP(3), ADD COLUMN "note" TEXT NOT NULL DEFAULT '';
CREATE TABLE "TenderDecision" (
 "id" TEXT PRIMARY KEY,"tenderId" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"accountId" TEXT NOT NULL,
 "role" TEXT NOT NULL,"status" TEXT NOT NULL,"note" TEXT NOT NULL,"contentVersion" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "TenderDecision_organizationId_tenderId_idx" ON "TenderDecision"("organizationId","tenderId");
