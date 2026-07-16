import pool from './configs/db.js';

const migrate = async () => {
  try {
    console.log('Creating admin_notifications table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        target_admin_id  INT UNSIGNED NOT NULL,
        title            VARCHAR(255) NOT NULL,
        message          TEXT NOT NULL,
        type             ENUM('alert','info','calendar','message','scheme','cmfund','csr','letter') NOT NULL DEFAULT 'info',
        module           VARCHAR(100) DEFAULT NULL,
        record_id        INT DEFAULT NULL,
        record_ref       VARCHAR(50) DEFAULT NULL,
        link_path        VARCHAR(255) DEFAULT NULL,
        is_read          TINYINT(1) NOT NULL DEFAULT 0,
        read_at          DATETIME DEFAULT NULL,
        created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_target_admin (target_admin_id),
        INDEX idx_is_read (is_read),
        FOREIGN KEY (target_admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ admin_notifications table created successfully.');

    const [cols] = await pool.query('SHOW COLUMNS FROM admin_notifications');
    console.log('Columns:', cols.map(c => c.Field).join(', '));

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

migrate();
