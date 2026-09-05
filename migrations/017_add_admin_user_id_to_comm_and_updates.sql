-- ============================================================================
-- Migration 017: Add admin_user_id to communications_logs and update tables
-- Ensures each communication log and follow-up entry permanently retains
-- the exact admin user who sent or authored it.
-- ============================================================================

-- 1. communications_logs
ALTER TABLE communications_logs
ADD COLUMN IF NOT EXISTS admin_user_id INT UNSIGNED NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_logs_admin_user_id ON communications_logs (admin_user_id);

-- Optional Foreign Key (ignore if already exists or if constraint fails)
-- ALTER TABLE communications_logs ADD CONSTRAINT fk_comm_logs_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;


-- 2. complaint_updates
ALTER TABLE complaint_updates
ADD COLUMN IF NOT EXISTS admin_user_id INT UNSIGNED NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_complaint_updates_admin_user_id ON complaint_updates (admin_user_id);

-- ALTER TABLE complaint_updates ADD CONSTRAINT fk_complaint_updates_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;


-- 3. cm_fund_updates (Applications)
ALTER TABLE cm_fund_updates
ADD COLUMN IF NOT EXISTS admin_user_id INT UNSIGNED NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_cm_fund_updates_admin_user_id ON cm_fund_updates (admin_user_id);

-- ALTER TABLE cm_fund_updates ADD CONSTRAINT fk_cm_fund_updates_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;


-- 4. issue_updates
ALTER TABLE issue_updates
ADD COLUMN IF NOT EXISTS admin_user_id INT UNSIGNED NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_issue_updates_admin_user_id ON issue_updates (admin_user_id);

-- ALTER TABLE issue_updates ADD CONSTRAINT fk_issue_updates_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;


-- 5. idea_updates
ALTER TABLE idea_updates
ADD COLUMN IF NOT EXISTS admin_user_id INT UNSIGNED NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_idea_updates_admin_user_id ON idea_updates (admin_user_id);

-- ALTER TABLE idea_updates ADD CONSTRAINT fk_idea_updates_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;


-- 6. suggestion_updates
ALTER TABLE suggestion_updates
ADD COLUMN IF NOT EXISTS admin_user_id INT UNSIGNED NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_suggestion_updates_admin_user_id ON suggestion_updates (admin_user_id);

-- ALTER TABLE suggestion_updates ADD CONSTRAINT fk_suggestion_updates_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;


-- ============================================================================
-- Backfill Historical Records where possible
-- ============================================================================

-- Backfill communications created during initial filing by admin
UPDATE communications_logs cl
JOIN complaints c ON cl.entity_type = 'Complaint' AND (
    cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci 
    OR cl.entity_id COLLATE utf8mb4_unicode_ci = c.reference_no COLLATE utf8mb4_unicode_ci
)
SET cl.admin_user_id = c.filed_by_admin_id
WHERE cl.admin_user_id IS NULL AND c.filed_by_admin_id IS NOT NULL;

UPDATE communications_logs cl
JOIN cm_fund_requests r ON (cl.entity_type = 'Application' OR cl.entity_type = 'CM_Fund' OR cl.entity_type = 'cm_fund') 
  AND cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(r.id AS CHAR) COLLATE utf8mb4_unicode_ci
SET cl.admin_user_id = r.submitted_by_id
WHERE cl.admin_user_id IS NULL AND r.submitted_by_id IS NOT NULL;

UPDATE communications_logs cl
JOIN issues i ON cl.entity_type = 'Issue' AND (
    cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(i.id AS CHAR) COLLATE utf8mb4_unicode_ci 
    OR cl.entity_id COLLATE utf8mb4_unicode_ci = i.reference_no COLLATE utf8mb4_unicode_ci
)
SET cl.admin_user_id = i.filed_by_admin_id
WHERE cl.admin_user_id IS NULL AND i.filed_by_admin_id IS NOT NULL;

UPDATE communications_logs cl
JOIN ideas d ON cl.entity_type = 'Idea' AND (
    cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(d.id AS CHAR) COLLATE utf8mb4_unicode_ci 
    OR cl.entity_id COLLATE utf8mb4_unicode_ci = d.reference_no COLLATE utf8mb4_unicode_ci
)
SET cl.admin_user_id = d.filed_by_admin_id
WHERE cl.admin_user_id IS NULL AND d.filed_by_admin_id IS NOT NULL;

UPDATE communications_logs cl
JOIN suggestions s ON cl.entity_type = 'Suggestion' AND (
    cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(s.id AS CHAR) COLLATE utf8mb4_unicode_ci 
    OR cl.entity_id COLLATE utf8mb4_unicode_ci = s.reference_no COLLATE utf8mb4_unicode_ci
)
SET cl.admin_user_id = s.filed_by_admin_id
WHERE cl.admin_user_id IS NULL AND s.filed_by_admin_id IS NOT NULL;

-- Backfill Application follow-up updates & comms from timeline events
UPDATE cm_fund_updates u
JOIN cm_fund_timeline_events t ON t.request_id COLLATE utf8mb4_unicode_ci = u.request_id COLLATE utf8mb4_unicode_ci 
  AND t.event_type = 'Follow-up Added' 
  AND ABS(TIMESTAMPDIFF(SECOND, t.created_at, u.created_at)) <= 10
SET u.admin_user_id = t.actor_id
WHERE u.admin_user_id IS NULL AND t.actor_id IS NOT NULL;

UPDATE communications_logs cl
JOIN cm_fund_timeline_events t ON t.request_id COLLATE utf8mb4_unicode_ci = cl.entity_id COLLATE utf8mb4_unicode_ci 
  AND ABS(TIMESTAMPDIFF(SECOND, t.created_at, cl.created_at)) <= 10
SET cl.admin_user_id = t.actor_id
WHERE cl.admin_user_id IS NULL AND t.actor_id IS NOT NULL;
