CREATE TABLE "BlobFile" (
 "id" TEXT PRIMARY KEY,"organizationId" TEXT NOT NULL,"uploadedBy" TEXT NOT NULL,
 "name" TEXT NOT NULL,"mime" TEXT NOT NULL,"kind" TEXT NOT NULL,"size" INTEGER NOT NULL,"sha256" TEXT NOT NULL,
 "original" BYTEA NOT NULL,"parentId" TEXT,"version" INTEGER NOT NULL DEFAULT 1,
 "scanStatus" TEXT NOT NULL,"scanNote" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BlobFile_organizationId_parentId_version_idx" ON "BlobFile"("organizationId","parentId","version");
