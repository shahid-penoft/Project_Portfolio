import pool from './configs/db.js';

const queries = [
  `CREATE TABLE IF NOT EXISTS cm_fund_updates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(30) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'Status Update',
    title VARCHAR(255) NOT NULL,
    note TEXT DEFAULT NULL,
    notify_complainant TINYINT(1) DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES cm_fund_requests(id) ON DELETE CASCADE,
    INDEX idx_cm_fund_updates (request_id)
  );`,

  `CREATE TABLE IF NOT EXISTS cm_fund_update_media (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    update_id INT UNSIGNED NOT NULL,
    media_type ENUM('photo', 'video', 'document') NOT NULL DEFAULT 'photo',
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(300) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (update_id) REFERENCES cm_fund_updates(id) ON DELETE CASCADE,
    INDEX idx_cm_fund_update_media (update_id)
  );`
];

async function run() {
  try {
    for (const q of queries) {
      await pool.query(q);
      console.log('Executed query successfully.');
    }
    console.log('CM Funds updates tables created!');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    process.exit();
  }
}

run();
