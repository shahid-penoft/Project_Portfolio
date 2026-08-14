-- ============================================================
-- Migration: Support String Entity IDs with Matching Collation
-- Module: Communications & Applications (CM Funds)
-- ============================================================

USE diavets_db;

-- 1. Standardize table and column collation to match entity tables (utf8mb4_0900_ai_ci)
ALTER TABLE communications_logs 
CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE communications_logs 
MODIFY COLUMN entity_id VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;

-- 2. Link specific application logs if you know the IDs:
-- UPDATE communications_logs
-- SET entity_id = 'YOUR_APP_ID_1'
-- WHERE entity_type = 'Application' AND (entity_id = '0' OR entity_id = '') AND message LIKE '%YOUR_APP_ID_1%';

-- UPDATE communications_logs
-- SET entity_id = 'YOUR_APP_ID_2'
-- WHERE entity_type = 'Application' AND (entity_id = '0' OR entity_id = '') AND message LIKE '%YOUR_APP_ID_2%';
