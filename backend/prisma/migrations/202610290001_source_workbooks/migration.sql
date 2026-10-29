CREATE TABLE "SourceWorkbook" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "sha256" TEXT NOT NULL, "original" BYTEA NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SourceWorkbook_organizationId_sha256_key" ON "SourceWorkbook"("organizationId", "sha256");
CREATE TABLE "SourceSheet" (
 "id" TEXT PRIMARY KEY, "workbookId" TEXT NOT NULL REFERENCES "SourceWorkbook"("id") ON DELETE CASCADE,
 "name" TEXT NOT NULL, "sort" INTEGER NOT NULL, "rowCount" INTEGER NOT NULL,
 "cellCount" INTEGER NOT NULL, "columns" JSONB NOT NULL, "rows" JSONB NOT NULL
);
CREATE INDEX "SourceSheet_workbookId_sort_idx" ON "SourceSheet"("workbookId", "sort");
