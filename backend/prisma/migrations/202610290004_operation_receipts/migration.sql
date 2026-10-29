CREATE TABLE "OperationReceipt" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
 "key" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "command" TEXT NOT NULL,
 "changedBooks" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OperationReceipt_organizationId_key_key" ON "OperationReceipt"("organizationId","key");
