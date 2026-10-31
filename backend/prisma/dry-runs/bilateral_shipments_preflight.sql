-- Read-only preflight for migration 202610310006_bilateral_shipments.
-- Run before applying the migration; this file makes no schema or data changes.

-- Existing shipment volume and line counts. Legacy rows remain readable after
-- the additive migration and are deliberately not treated as signed transfers.
SELECT
  COUNT(*) AS shipment_count,
  COUNT(*) FILTER (WHERE cardinality("stops") < 2) AS short_route_count,
  COALESCE(SUM(line_counts.line_count), 0) AS shipment_line_count
FROM "Shipment" AS shipment
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS line_count
  FROM "ShipmentLine" AS line
  WHERE line."shipmentId" = shipment."id"
) AS line_counts ON TRUE;

-- Existing route endpoints that do not resolve to a location in the same
-- organization. These rows need manual review if they are expected to become
-- signed transfer documents later.
SELECT shipment."id", shipment."organizationId", shipment."stops"
FROM "Shipment" AS shipment
LEFT JOIN "Location" AS source
  ON source."id" = shipment."stops"[1]
 AND source."organizationId" = shipment."organizationId"
LEFT JOIN "Location" AS target
  ON target."id" = shipment."stops"[cardinality(shipment."stops")]
 AND target."organizationId" = shipment."organizationId"
WHERE cardinality(shipment."stops") < 2
   OR source."id" IS NULL
   OR target."id" IS NULL;

-- Shipment lines with a missing or cross-organization material reference.
SELECT line."shipmentId", line."materialId", shipment."organizationId"
FROM "ShipmentLine" AS line
JOIN "Shipment" AS shipment ON shipment."id" = line."shipmentId"
LEFT JOIN "Material" AS material
  ON material."id" = line."materialId"
 AND material."organizationId" = shipment."organizationId"
WHERE material."id" IS NULL;
