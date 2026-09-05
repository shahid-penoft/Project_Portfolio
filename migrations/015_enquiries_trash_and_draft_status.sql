-- =============================================================================
-- Migration 015: Enquiries Module Production Migration
-- =============================================================================

-- 1. Ensure `is_system` column exists on `mla_dropdown_lists` (if not already added)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'mla_dropdown_lists' 
      AND COLUMN_NAME = 'is_system'
);
SET @sql_add_is_system = IF(@col_exists = 0, 
    'ALTER TABLE mla_dropdown_lists ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0', 
    'SELECT "Column is_system already exists"'
);
PREPARE stmt FROM @sql_add_is_system;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add `is_deleted` and `deleted_at` to `contact_enquiries` (Trash support)
SET @col_deleted_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'contact_enquiries' 
      AND COLUMN_NAME = 'is_deleted'
);
SET @sql_add_deleted = IF(@col_deleted_exists = 0, 
    'ALTER TABLE contact_enquiries ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL', 
    'SELECT "Column is_deleted already exists"'
);
PREPARE stmt FROM @sql_add_deleted;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for soft deleted enquiry queries
SET @idx_del_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'contact_enquiries' 
      AND INDEX_NAME = 'idx_enquiries_is_deleted'
);
SET @sql_add_idx_del = IF(@idx_del_exists = 0, 
    'CREATE INDEX idx_enquiries_is_deleted ON contact_enquiries (is_deleted, created_at)', 
    'SELECT "Index idx_enquiries_is_deleted already exists"'
);
PREPARE stmt FROM @sql_add_idx_del;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Alter `status` and `category` from ENUM to VARCHAR(100) with proper defaults
ALTER TABLE contact_enquiries 
    MODIFY COLUMN status VARCHAR(100) NOT NULL DEFAULT 'Draft';

ALTER TABLE contact_enquiries 
    MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'General';

-- Index for status queries
SET @idx_stat_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'contact_enquiries' 
      AND INDEX_NAME = 'idx_enquiries_status_created'
);
SET @sql_add_idx_stat = IF(@idx_stat_exists = 0, 
    'CREATE INDEX idx_enquiries_status_created ON contact_enquiries (status, created_at)', 
    'SELECT "Index idx_enquiries_status_created already exists"'
);
PREPARE stmt FROM @sql_add_idx_stat;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Create `enquiry_notes` table if not exists (Internal Notes drawer)
CREATE TABLE IF NOT EXISTS `enquiry_notes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `enquiry_id` INT UNSIGNED NOT NULL,
    `note` TEXT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_enquiry` (`enquiry_id`),
    CONSTRAINT `fk_note_enquiry` FOREIGN KEY (`enquiry_id`) REFERENCES `contact_enquiries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Standardize legacy enquiry status values
UPDATE contact_enquiries SET status = 'Draft' WHERE status IN ('New', 'new');
UPDATE contact_enquiries SET status = 'Read' WHERE status = 'read';
UPDATE contact_enquiries SET status = 'In Progress' WHERE status IN ('in progress', 'in_progress');
UPDATE contact_enquiries SET status = 'Resolved' WHERE status = 'resolved';
UPDATE contact_enquiries SET status = 'Closed' WHERE status = 'closed';

-- Standardize category values to title case
UPDATE contact_enquiries SET category = 'General' WHERE LOWER(category) = 'general';
UPDATE contact_enquiries SET category = 'Membership' WHERE LOWER(category) = 'membership';
UPDATE contact_enquiries SET category = 'Local Issues' WHERE LOWER(category) = 'local issues';
UPDATE contact_enquiries SET category = 'Submit Ideas' WHERE LOWER(category) = 'submit ideas';
UPDATE contact_enquiries SET category = 'Submit Opinions' WHERE LOWER(category) = 'submit opinions';

-- 6. Clean up obsolete 'New' / test options from mla_dropdown_lists
DELETE FROM mla_dropdown_lists 
WHERE `key` = 'enquiry_status' 
  AND (value IN ('New', 'new', 'test') OR label IN ('New', 'new', 'test'));

-- 7. Seed / Update `enquiry_status` options (with locked Draft as default)
INSERT INTO mla_dropdown_lists (`key`, module, sub_category, label, value, parent_id, color, sort_order, is_default, is_system, status)
VALUES 
  ('enquiry_status', 'Enquiries', 'Status Labels', 'Draft', 'Draft', 0, 'slate', 10, 1, 1, 'Active'),
  ('enquiry_status', 'Enquiries', 'Status Labels', 'Read', 'Read', 0, 'blue', 20, 0, 0, 'Active'),
  ('enquiry_status', 'Enquiries', 'Status Labels', 'In Progress', 'In Progress', 0, 'amber', 30, 0, 0, 'Active'),
  ('enquiry_status', 'Enquiries', 'Status Labels', 'Resolved', 'Resolved', 0, 'green', 40, 0, 0, 'Active'),
  ('enquiry_status', 'Enquiries', 'Status Labels', 'Closed', 'Closed', 0, 'gray', 50, 0, 0, 'Active')
ON DUPLICATE KEY UPDATE 
  label = VALUES(label),
  color = VALUES(color),
  sort_order = VALUES(sort_order),
  is_default = VALUES(is_default),
  is_system = VALUES(is_system),
  status = 'Active';

-- 8. Seed `enquiry_category` options
INSERT IGNORE INTO mla_dropdown_lists (`key`, module, sub_category, label, value, parent_id, sort_order, is_default, is_system, status)
VALUES 
  ('enquiry_category', 'Enquiries', 'Categories', 'General', 'General', 0, 10, 1, 0, 'Active'),
  ('enquiry_category', 'Enquiries', 'Categories', 'Membership', 'Membership', 0, 20, 0, 0, 'Active'),
  ('enquiry_category', 'Enquiries', 'Categories', 'Local Issues', 'Local Issues', 0, 30, 0, 0, 'Active'),
  ('enquiry_category', 'Enquiries', 'Categories', 'Submit Ideas', 'Submit Ideas', 0, 40, 0, 0, 'Active'),
  ('enquiry_category', 'Enquiries', 'Categories', 'Submit Opinions', 'Submit Opinions', 0, 50, 0, 0, 'Active'),
  ('enquiry_category', 'Enquiries', 'Categories', 'Other', 'Other', 0, 60, 0, 0, 'Active');
