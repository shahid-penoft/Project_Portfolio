-- ============================================================
-- 006: Fix orphaned complaint statuses (empty string → Under Process)
--
-- Context:
--   Before migration 004, the complaints.status column was a strict
--   ENUM. Any custom dropdown value was silently rejected, storing
--   an empty string '' instead of the intended value.
--
--   This migration fixes those 11 records by setting their status
--   to 'Under Process' (the most appropriate active workflow state).
--
--   Draft records (status = 'Draft') are intentionally excluded.
-- ============================================================

UPDATE complaints
  SET status = 'Under Process'
  WHERE status = ''
    AND is_deleted = 0;
