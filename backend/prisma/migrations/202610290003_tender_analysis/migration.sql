CREATE TABLE "TenderAnalysis" (
 "id" TEXT PRIMARY KEY, "tenderId" TEXT NOT NULL REFERENCES "TenderCase"("id") ON DELETE CASCADE,
 "organizationId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "sourceName" TEXT NOT NULL,
 "sourceHash" TEXT NOT NULL, "sourceText" TEXT NOT NULL, "brief" JSONB NOT NULL, "evidence" JSONB NOT NULL,
 "confirmedBy" TEXT, "confirmedAt" TIMESTAMP(3), "comparedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TenderAnalysis_tenderId_revision_key" ON "TenderAnalysis"("tenderId","revision");
CREATE INDEX "TenderAnalysis_organizationId_tenderId_idx" ON "TenderAnalysis"("organizationId","tenderId");
