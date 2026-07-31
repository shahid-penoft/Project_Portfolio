-- ─────────────────────────────────────────────────────────────────────────
-- Migration 003: Add is_default column to mla_dropdown_lists
-- Tracks which item is the "default" for new record creation per key group
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE mla_dropdown_lists
  ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0
  AFTER sort_order;

-- Seed: mark the item with the lowest sort_order per key as the default.
-- This matches the behaviour of the lowest sort_order item being first in dropdowns.
UPDATE mla_dropdown_lists d
JOIN (
  SELECT `key`, MIN(sort_order) AS min_sort
  FROM mla_dropdown_lists
  WHERE IFNULL(parent_id, 0) = 0    -- only root-level items are defaults
  GROUP BY `key`
) g ON d.`key` = g.`key` AND d.sort_order = g.min_sort AND IFNULL(d.parent_id, 0) = 0
SET d.is_default = 1;
