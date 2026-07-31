-- ─────────────────────────────────────────────────────────────────────────
-- Migration 001: Cleanup existing duplicate dropdown values
-- Run ONCE before applying the unique constraint (Migration 002)
-- Keeps the row with the LOWEST id when duplicates exist on (key, value, parent_id)
-- ─────────────────────────────────────────────────────────────────────────

DELETE d1
FROM mla_dropdown_lists d1
INNER JOIN mla_dropdown_lists d2
  ON  d1.`key`                  = d2.`key`
  AND LOWER(d1.value)           = LOWER(d2.value)
  AND IFNULL(d1.parent_id, 0)   = IFNULL(d2.parent_id, 0)
  AND d1.id                     > d2.id;

-- Verify: the following query should return 0 rows after cleanup
-- SELECT `key`, LOWER(value) AS lv, IFNULL(parent_id,0) AS pid, COUNT(*) AS cnt
-- FROM mla_dropdown_lists
-- GROUP BY `key`, LOWER(value), IFNULL(parent_id,0)
-- HAVING cnt > 1;
