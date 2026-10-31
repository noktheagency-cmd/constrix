-- CONSTRIX stock reservation preflight (PostgreSQL)
-- Read-only. Run against a production snapshot or explicitly selected test database.
-- This script describes current request and shared-warehouse stock exposure; it applies no changes.

BEGIN READ ONLY;

-- A. Request volumes before reservation tracking. Existing requests are not backfilled as reserved.
SELECT "organizationId", "status", COUNT(*) AS request_count,
       SUM("qty") AS requested_qty
FROM "MaterialRequest"
WHERE "organizationId" IS NOT NULL
GROUP BY "organizationId", "status"
ORDER BY "organizationId", "status";

-- B. Shared warehouse stock eligible for new automatic reservations.
-- Project/site locations are intentionally excluded from automatic allocation.
SELECT s."organizationId", s."materialId", m."name" AS material_name,
       s."locationId", l."name" AS location_name, l."kind",
       s."qty" AS physical_qty
FROM "Stock" s
JOIN "Location" l ON l."id" = s."locationId"
JOIN "Material" m ON m."id" = s."materialId"
WHERE s."organizationId" = l."organizationId"
  AND s."organizationId" = m."organizationId"
  AND l."projectId" IS NULL
  AND s."qty" > 0
ORDER BY s."organizationId", m."name", l."name";

-- C. Requests with missing or cross-organization material links, which block approval allocation.
SELECT r."organizationId", r."id" AS request_id, r."status", r."materialId",
       m."organizationId" AS material_organization
FROM "MaterialRequest" r
LEFT JOIN "Material" m ON m."id" = r."materialId"
WHERE r."organizationId" IS NOT NULL
  AND (m."id" IS NULL OR m."organizationId" <> r."organizationId")
ORDER BY r."organizationId", r."id";

-- D. Locations or stocks whose tenant ownership does not align; these cannot be reserved safely.
SELECT s."organizationId", s."materialId", s."locationId", l."organizationId" AS location_organization
FROM "Stock" s
LEFT JOIN "Location" l ON l."id" = s."locationId"
WHERE s."organizationId" IS NOT NULL
  AND (l."id" IS NULL OR l."organizationId" <> s."organizationId")
ORDER BY s."organizationId", s."materialId", s."locationId";

ROLLBACK;
