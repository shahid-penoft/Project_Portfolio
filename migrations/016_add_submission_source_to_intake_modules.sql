-- ============================================================================
-- Migration 016: Add submission_source to Core Intake Modules
-- Modules: Complaints, Applications (cm_fund_requests), Issues, Ideas, Suggestions
-- ============================================================================

-- 1. Complaints
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS submission_source VARCHAR(50) NOT NULL DEFAULT 'Public Portal';

-- Add index for fast querying by submission_source
CREATE INDEX IF NOT EXISTS idx_complaints_submission_source ON complaints (submission_source, created_at);

-- Backfill complaints historical data based on filed_by_admin_id
UPDATE complaints
SET submission_source = 'Admin Panel'
WHERE filed_by_admin_id IS NOT NULL;

UPDATE complaints
SET submission_source = 'Public Portal'
WHERE filed_by_admin_id IS NULL;


-- 2. Applications (cm_fund_requests)
ALTER TABLE cm_fund_requests
ADD COLUMN IF NOT EXISTS submission_source VARCHAR(50) NOT NULL DEFAULT 'Public Portal';

CREATE INDEX IF NOT EXISTS idx_cm_funds_submission_source ON cm_fund_requests (submission_source, created_at);

-- Backfill applications historical data based on submitted_by_id (admin user id)
UPDATE cm_fund_requests
SET submission_source = 'Admin Panel'
WHERE submitted_by_id IS NOT NULL;

UPDATE cm_fund_requests
SET submission_source = 'Public Portal'
WHERE submitted_by_id IS NULL;


-- 3. Public Issues
ALTER TABLE issues
ADD COLUMN IF NOT EXISTS submission_source VARCHAR(50) NOT NULL DEFAULT 'Public Portal';

CREATE INDEX IF NOT EXISTS idx_issues_submission_source ON issues (submission_source, created_at);

UPDATE issues
SET submission_source = 'Admin Panel'
WHERE filed_by_admin_id IS NOT NULL;

UPDATE issues
SET submission_source = 'Public Portal'
WHERE filed_by_admin_id IS NULL;


-- 4. Ideas
ALTER TABLE ideas
ADD COLUMN IF NOT EXISTS submission_source VARCHAR(50) NOT NULL DEFAULT 'Public Portal';

CREATE INDEX IF NOT EXISTS idx_ideas_submission_source ON ideas (submission_source, created_at);

UPDATE ideas
SET submission_source = 'Admin Panel'
WHERE filed_by_admin_id IS NOT NULL;

UPDATE ideas
SET submission_source = 'Public Portal'
WHERE filed_by_admin_id IS NULL;


-- 5. Suggestions
ALTER TABLE suggestions
ADD COLUMN IF NOT EXISTS submission_source VARCHAR(50) NOT NULL DEFAULT 'Public Portal';

CREATE INDEX IF NOT EXISTS idx_suggestions_submission_source ON suggestions (submission_source, created_at);

UPDATE suggestions
SET submission_source = 'Admin Panel'
WHERE filed_by_admin_id IS NOT NULL;

UPDATE suggestions
SET submission_source = 'Public Portal'
WHERE filed_by_admin_id IS NULL;
