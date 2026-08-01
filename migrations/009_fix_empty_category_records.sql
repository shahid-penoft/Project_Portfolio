-- ============================================================
-- 009: Fix empty-string category values from ENUM era
--
-- Context:
--   The category columns for all petition modules previously had
--   an ENUM or DEFAULT that could result in empty strings being
--   stored when no category was selected (or if the submitted value
--   was rejected by the old ENUM constraint).
--
--   NULL is the correct representation for "no category selected".
--   The frontend already handles NULL by showing a neutral dash (—)
--   instead of a "Not Available" badge.
--
--   This migration converts all remaining '' category records to NULL.
--   Records with valid categories are untouched.
-- ============================================================

-- Complaints: 18 records with category = ''
UPDATE complaints
  SET category = NULL
  WHERE category = '' AND is_deleted = 0;

-- Issues: 29 records with category = ''
UPDATE issues
  SET category = NULL
  WHERE category = '' AND is_deleted = 0;

-- Ideas: 1 record with category = ''
UPDATE ideas
  SET category = NULL
  WHERE category = '' AND is_deleted = 0;

-- Suggestions: 1 record with category = ''
UPDATE suggestions
  SET category = NULL
  WHERE category = '' AND is_deleted = 0;
