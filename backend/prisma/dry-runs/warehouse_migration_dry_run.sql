-- CONSTRIX warehouse migration preflight (PostgreSQL)
-- Read-only. Run on a production snapshot or explicitly selected test database.
-- This script does not apply Prisma migrations and must be reviewed alongside the result.

BEGIN READ ONLY;

-- A. Purchase acts that will need legacy/manual reconciliation.
SELECT "organizationId", "status", COUNT(*) AS act_count,
       MIN("date") AS first_date, MAX("date") AS last_date
FROM "PurchaseAct"
GROUP BY "organizationId", "status"
ORDER BY "organizationId", "status";

-- B. Existing payable identifiers: count exact act ID and legacy act-number matches.
SELECT a."organizationId", a."id" AS act_id, a."number" AS act_number,
       p."supplier", p."status" AS payable_status, COUNT(*) AS payable_rows,
       SUM(p."amount") AS payable_amount
FROM "PurchaseAct" a
JOIN "Payable" p ON p."organizationId" = a."organizationId"
 AND (p."poId" = a."id" OR p."poId" = a."number")
GROUP BY a."organizationId", a."id", a."number", p."supplier", p."status"
HAVING COUNT(*) > 1 OR p."poId" = a."number"
ORDER BY a."organizationId", a."number", p."supplier";

-- C. Potential duplicate supplier aliases within a tenant (case/space normalized).
SELECT "organizationId", LOWER(BTRIM("supplier")) AS normalized_supplier,
       ARRAY_AGG(DISTINCT "supplier" ORDER BY "supplier") AS source_names,
       COUNT(*) AS payable_rows, SUM("amount") AS net_amount
FROM "Payable"
WHERE "organizationId" IS NOT NULL
GROUP BY "organizationId", LOWER(BTRIM("supplier"))
HAVING COUNT(DISTINCT "supplier") > 1
ORDER BY "organizationId", normalized_supplier;

-- D. Material / Stock / lot totals; differences are diagnostics, not corrections.
WITH stock AS (
  SELECT "organizationId", "materialId", SUM("qty") AS qty
  FROM "Stock" GROUP BY "organizationId", "materialId"
), lots AS (
  SELECT "organizationId", "materialId", SUM("qty") AS qty
  FROM "StockLot" GROUP BY "organizationId", "materialId"
)
SELECT m."organizationId", m."id" AS material_id, m."name", m."unit",
       m."qty" AS material_qty, COALESCE(SUM(s.qty), 0) AS stock_qty,
       COALESCE(SUM(l.qty), 0) AS lot_qty,
       COALESCE(SUM(s.qty), 0) - m."qty" AS stock_minus_material,
       COALESCE(SUM(l.qty), 0) - COALESCE(SUM(s.qty), 0) AS lot_minus_stock
FROM "Material" m
LEFT JOIN stock s ON s."organizationId" = m."organizationId" AND s."materialId" = m."id"
LEFT JOIN lots l ON l."organizationId" = m."organizationId" AND l."materialId" = m."id"
GROUP BY m."organizationId", m."id", m."name", m."unit", m."qty"
HAVING COALESCE(SUM(s.qty), 0) <> m."qty" OR COALESCE(SUM(l.qty), 0) <> COALESCE(SUM(s.qty), 0)
ORDER BY m."organizationId", m."name";

-- E. Movement type coverage. Only medaxil/mexaric/transfer can be netted by the current read model.
SELECT "organizationId", "type", COUNT(*) AS movement_rows,
       COUNT(*) FILTER (WHERE "materialId" IS NULL) AS unlinked_material_rows,
       COUNT(*) FILTER (WHERE "locationId" IS NULL) AS unlinked_location_rows,
       SUM("qty") AS gross_qty
FROM "Movement"
GROUP BY "organizationId", "type"
ORDER BY "organizationId", "type";

-- F. Current stock less known net movement is an inferred residual only.
-- It may include opening stock AND unrecorded/unsupported legacy movements.
WITH net AS (
  SELECT "organizationId", "materialId", "locationId",
         SUM(CASE WHEN "type" = 'medaxil' THEN "qty"
                  WHEN "type" = 'mexaric' THEN -"qty"
                  WHEN "type" = 'transfer' THEN "qty"
                  ELSE 0 END) AS known_net_qty
  FROM "Movement"
  GROUP BY "organizationId", "materialId", "locationId"
  UNION ALL
  SELECT "organizationId", "materialId", "from" AS "locationId", -SUM("qty") AS known_net_qty
  FROM "Movement" WHERE "type"='transfer' AND "from" IS NOT NULL
  GROUP BY "organizationId", "materialId", "from"
), stock AS (
  SELECT "organizationId", "materialId", "locationId", SUM("qty") AS stock_qty
  FROM "Stock" GROUP BY "organizationId", "materialId", "locationId"
), movement_net AS (
  SELECT "organizationId", "materialId", "locationId", SUM(known_net_qty) AS known_net_qty
  FROM net GROUP BY "organizationId", "materialId", "locationId"
)
SELECT COALESCE(s."organizationId", n."organizationId") AS organization_id,
       COALESCE(s."materialId", n."materialId") AS material_id,
       COALESCE(s."locationId", n."locationId") AS location_id,
       COALESCE(s.stock_qty, 0) AS stock_qty,
       COALESCE(n.known_net_qty, 0) AS known_net_movement_qty,
       COALESCE(s.stock_qty, 0) - COALESCE(n.known_net_qty, 0) AS inferred_opening_or_unexplained_qty
FROM stock s FULL OUTER JOIN movement_net n
  ON n."organizationId" = s."organizationId"
 AND n."materialId" = s."materialId"
 AND n."locationId" = s."locationId"
ORDER BY organization_id, material_id, location_id;

ROLLBACK;
