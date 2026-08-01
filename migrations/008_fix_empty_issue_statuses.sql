-- ============================================================
-- 008: Fix empty-string issue statuses from ENUM era
--
-- Context:
--   The issues.status column was previously a strict ENUM that did
--   not include 'Pending'. Any issue submitted with that value (or
--   no valid value) was silently stored as '' (empty string).
--
--   The cascade rename from "Pending" → "Under Process" correctly
--   ran but affected 0 rows because no records had status='Pending'.
--
--   This migration resets those 24 empty-string records to the
--   current active default: 'Under Process'.
--   Draft records are intentionally excluded.
-- ============================================================

UPDATE issues
  SET status = 'Under Process'
  WHERE status = ''
    AND is_deleted = 0;
