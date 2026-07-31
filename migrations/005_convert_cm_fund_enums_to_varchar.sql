-- ============================================================
-- 005: Convert CM Fund ENUM columns to VARCHAR for dynamic dropdowns
--
-- Affected tables:
--   cm_fund_requests.priority        ENUM -> VARCHAR(255)
--   cm_fund_categories.application_type  ENUM -> VARCHAR(100) (internal/structural, but convert for safety)
--   cm_fund_document_types.status    ENUM -> VARCHAR(50)     (Active/Inactive is system-managed, low priority)
-- ============================================================

-- cm_fund_requests: priority drives the key user-facing field
ALTER TABLE `cm_fund_requests`
  MODIFY COLUMN `priority` VARCHAR(255) NOT NULL DEFAULT 'Normal';

-- cm_fund_categories: application_type is used as a filter field
ALTER TABLE `cm_fund_categories`
  MODIFY COLUMN `application_type` VARCHAR(100) NOT NULL DEFAULT 'General';

-- cm_fund_document_types: status is an internal admin toggle, still convert for consistency
ALTER TABLE `cm_fund_document_types`
  MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Active';
