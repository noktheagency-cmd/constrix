ALTER TABLE "SmetaLine" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'work';
ALTER TABLE "SmetaLine" ADD COLUMN "houseNo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SmetaLine" ADD COLUMN "section" TEXT NOT NULL DEFAULT '';
CREATE INDEX "SmetaLine_smetaId_houseNo_idx" ON "SmetaLine"("smetaId", "houseNo");

CREATE TABLE "PurchaseAct" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "projectId" TEXT,
    "project" TEXT NOT NULL DEFAULT '',
    "objectName" TEXT NOT NULL,
    "person" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseAct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseActLine" (
    "id" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "materialName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "cashPaid" DECIMAL(14,2),
    "firmName" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "sender" TEXT NOT NULL DEFAULT '',
    "materialId" TEXT,

    CONSTRAINT "PurchaseActLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseActAdjust" (
    "id" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "materialName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "diff" DECIMAL(14,4) NOT NULL,
    "diffAmount" DECIMAL(14,2) NOT NULL,
    "actLabel" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PurchaseActAdjust_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseAct_projectId_idx" ON "PurchaseAct"("projectId");
CREATE INDEX "PurchaseAct_date_idx" ON "PurchaseAct"("date");
CREATE INDEX "PurchaseAct_organizationId_idx" ON "PurchaseAct"("organizationId");
CREATE INDEX "PurchaseActLine_actId_sort_idx" ON "PurchaseActLine"("actId", "sort");
CREATE INDEX "PurchaseActAdjust_actId_sort_idx" ON "PurchaseActAdjust"("actId", "sort");

ALTER TABLE "PurchaseActLine" ADD CONSTRAINT "PurchaseActLine_actId_fkey" FOREIGN KEY ("actId") REFERENCES "PurchaseAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseActAdjust" ADD CONSTRAINT "PurchaseActAdjust_actId_fkey" FOREIGN KEY ("actId") REFERENCES "PurchaseAct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
