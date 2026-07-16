/**
 * Migration: Create user_notifications table
 * Constituent-facing in-app notification system
 * Run once: node migrate_user_notifications.js
 */
import pool from './configs/db.js';

const sql = `
CREATE TABLE IF NOT EXISTS user_notifications (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  target_user_id   INT UNSIGNED NOT NULL,
  title            VARCHAR(255)  NOT NULL,
  message          TEXT,
  type             VARCHAR(50)   DEFAULT 'info',
  module           VARCHAR(80),
  record_ref       VARCHAR(120),
  link_path        VARCHAR(500),
  is_read          TINYINT(1)    DEFAULT 0,
  created_at       DATETIME      DEFAULT NOW(),
  INDEX idx_target (target_user_id),
  INDEX idx_unread (target_user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('✅  user_notifications table created (or already exists).');
    process.exit(0);
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  }
})();
