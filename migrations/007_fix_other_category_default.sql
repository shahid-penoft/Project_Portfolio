-- ============================================================
-- 007: Fix orphaned "Other" category values and column defaults
--
-- Context:
--   The category columns previously defaulted to 'Other'.
--   Since 'Other' is not in the system_category Dropdown Manager,
--   all such records displayed "Not Available" in the UI.
--
--   This migration:
--   1. Sets existing category='Other' records to NULL
--      so the frontend shows a neutral "—" placeholder.
--   2. Changes column defaults from 'Other' to NULL
--      so new records without a chosen category store NULL.
-- ============================================================

-- Reset existing 'Other' records to NULL
UPDATE complaints   SET category = NULL WHERE category = 'Other' AND is_deleted = 0;
UPDATE issues       SET category = NULL WHERE category = 'Other' AND is_deleted = 0;
UPDATE ideas        SET category = NULL WHERE category = 'Other' AND is_deleted = 0;
UPDATE suggestions  SET category = NULL WHERE category = 'Other' AND is_deleted = 0;

-- Change column defaults: 'Other' → NULL
ALTER TABLE complaints  MODIFY COLUMN category VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE issues      MODIFY COLUMN category VARCHAR(150) NULL DEFAULT NULL;
ALTER TABLE ideas       MODIFY COLUMN category VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE suggestions MODIFY COLUMN category VARCHAR(255) NULL DEFAULT NULL;
