-- ============================================================================
-- Migration 018: Add hide_from_public and communication dispatch tracking to updates
-- ============================================================================

-- 1. complaint_updates
ALTER TABLE complaint_updates
ADD COLUMN IF NOT EXISTS hide_from_public TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm_channel VARCHAR(50) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comm_sent_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_body TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sms_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_body TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_complaint_updates_hide_from_public ON complaint_updates (hide_from_public);

-- 2. issue_updates
ALTER TABLE issue_updates
ADD COLUMN IF NOT EXISTS hide_from_public TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm_channel VARCHAR(50) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comm_sent_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_body TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sms_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_body TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_issue_updates_hide_from_public ON issue_updates (hide_from_public);

-- 3. idea_updates
ALTER TABLE idea_updates
ADD COLUMN IF NOT EXISTS hide_from_public TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm_channel VARCHAR(50) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comm_sent_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_body TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sms_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_body TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_idea_updates_hide_from_public ON idea_updates (hide_from_public);

-- 4. suggestion_updates
ALTER TABLE suggestion_updates
ADD COLUMN IF NOT EXISTS hide_from_public TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm_channel VARCHAR(50) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comm_sent_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_body TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sms_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_body TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_suggestion_updates_hide_from_public ON suggestion_updates (hide_from_public);

-- 5. cm_fund_updates
ALTER TABLE cm_fund_updates
ADD COLUMN IF NOT EXISTS hide_from_public TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm_channel VARCHAR(50) NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comm_sent_at DATETIME NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_body TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sms_sent TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sms_body TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_cm_fund_updates_hide_from_public ON cm_fund_updates (hide_from_public);

-- 6. communications_logs
ALTER TABLE communications_logs
ADD COLUMN IF NOT EXISTS update_id INT UNSIGNED NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_logs_update_id ON communications_logs (update_id);

-- Backfill existing SMS records: if sms_sent = 1 and comm_channel IS NULL, set comm_channel = 'sms' and comm_sent_at = created_at
UPDATE complaint_updates SET comm_channel = 'sms', comm_sent_at = created_at WHERE sms_sent = 1 AND comm_channel IS NULL;
UPDATE issue_updates SET comm_channel = 'sms', comm_sent_at = created_at WHERE sms_sent = 1 AND comm_channel IS NULL;
UPDATE idea_updates SET comm_channel = 'sms', comm_sent_at = created_at WHERE sms_sent = 1 AND comm_channel IS NULL;
UPDATE suggestion_updates SET comm_channel = 'sms', comm_sent_at = created_at WHERE sms_sent = 1 AND comm_channel IS NULL;
UPDATE cm_fund_updates SET comm_channel = 'sms', comm_sent_at = created_at WHERE sms_sent = 1 AND comm_channel IS NULL;
