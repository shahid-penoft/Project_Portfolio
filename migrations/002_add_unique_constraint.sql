-- ─────────────────────────────────────────────────────────────────────────
-- Migration 002: Add UNIQUE constraint on (key, value, parent_id)
-- MUST run AFTER 001_cleanup_dropdown_duplicates.sql
-- ─────────────────────────────────────────────────────────────────────────

-- Step 1: Normalise NULLs in parent_id so the unique index works correctly.
-- MySQL treats NULLs as distinct in unique indexes, so two rows with
-- (key='x', value='y', parent_id=NULL) would NOT collide. We use 0 as the
-- "no parent" sentinel instead of NULL.
UPDATE mla_dropdown_lists SET parent_id = 0 WHERE parent_id IS NULL;

-- Step 2: Add the unique index without prefix lengths.
-- Prefix lengths (e.g. key(100)) are only needed for TEXT/BLOB columns.
-- For VARCHAR columns MySQL uses the full column length automatically.
ALTER TABLE mla_dropdown_lists
  ADD UNIQUE INDEX uq_dropdown_key_value_parent (`key`, value, parent_id);
