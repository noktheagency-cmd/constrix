ALTER TABLE "Shipment"
  ADD COLUMN "fromLocationId" TEXT,
  ADD COLUMN "toLocationId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "dispatchedBy" TEXT,
  ADD COLUMN "dispatchedById" TEXT,
  ADD COLUMN "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN "receivedBy" TEXT,
  ADD COLUMN "receivedById" TEXT,
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT;

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_fromLocationId_fkey"
    FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Shipment_toLocationId_fkey"
    FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Shipment_organizationId_status_idx"
  ON "Shipment"("organizationId", "status");
CREATE INDEX "Shipment_organizationId_fromLocationId_status_idx"
  ON "Shipment"("organizationId", "fromLocationId", "status");
