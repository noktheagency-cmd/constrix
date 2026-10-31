ALTER TABLE "MaterialRequest"
  ADD COLUMN "fulfilledQty" DECIMAL(14,3) NOT NULL DEFAULT 0;

CREATE TABLE "StockReservation" (
  "organizationId" TEXT NOT NULL,
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "qty" DECIMAL(14,3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdBy" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockReservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StockReservation_organizationId_materialId_locationId_status_idx"
  ON "StockReservation"("organizationId", "materialId", "locationId", "status");
CREATE INDEX "StockReservation_organizationId_requestId_status_idx"
  ON "StockReservation"("organizationId", "requestId", "status");
