-- Migration 014: Disable Legacy Module-Specific Category Dropdowns
-- 
-- Background:
-- Complaints, Issues, Ideas, and Suggestions originally had flat category lists
-- (complaint_category, issue_category, idea_category, suggestion_category).
-- All citizen/staff forms and module filters have since been unified to consume
-- the nested `system_category` dropdown.
--
-- This migration marks the obsolete flat category lists as 'Disabled' so they
-- are retired from active use while preserving historical data integrity.

UPDATE mla_dropdown_lists
SET status = 'Disabled'
WHERE `key` IN (
  'complaint_category',
  'issue_category',
  'idea_category',
  'suggestion_category'
);
