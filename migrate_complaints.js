import pool from './configs/db.js';

const queries = [
  `CREATE TABLE IF NOT EXISTS complaints (
      id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
      reference_no        VARCHAR(30)     NOT NULL UNIQUE,
      title               VARCHAR(255)    NOT NULL,
      category            ENUM(
                            'Road & Transport','Water & Sanitation','Electricity',
                            'Public Safety','Health','Education',
                            'Infrastructure','Environment','Other'
                          ) NOT NULL DEFAULT 'Other',
      priority            ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
      status              ENUM(
                            'Pending','Under Process','Not Attended',
                            'Resolved','Escalated','Draft'
                          ) NOT NULL DEFAULT 'Pending',
      description         TEXT            DEFAULT NULL,
      location            VARCHAR(500)    DEFAULT NULL,
      internal_note       TEXT            DEFAULT NULL,
      complainant_name    VARCHAR(150)    NOT NULL,
      phone               VARCHAR(25)     NOT NULL,
      alternative_phone   VARCHAR(25)     DEFAULT NULL,
      email               VARCHAR(200)    DEFAULT NULL,
      local_body_id       INT UNSIGNED    DEFAULT NULL,
      ward_id             INT UNSIGNED    DEFAULT NULL,
      department_id       INT UNSIGNED    DEFAULT NULL,
      constituent_user_id INT UNSIGNED    DEFAULT NULL,
      filed_by_admin_id   INT UNSIGNED    DEFAULT NULL,
      is_deleted          BOOLEAN         NOT NULL DEFAULT 0,
      deleted_at          DATETIME        DEFAULT NULL,
      date_filed          DATE            NOT NULL DEFAULT (CURRENT_DATE),
      created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (local_body_id)       REFERENCES local_bodies(id)       ON DELETE SET NULL,
      FOREIGN KEY (ward_id)             REFERENCES local_body_wards(id)   ON DELETE SET NULL,
      FOREIGN KEY (department_id)       REFERENCES departments(id)        ON DELETE SET NULL,
      FOREIGN KEY (constituent_user_id) REFERENCES constituent_users(id)  ON DELETE SET NULL,
      FOREIGN KEY (filed_by_admin_id)   REFERENCES admin_users(id)        ON DELETE SET NULL,
      INDEX idx_status      (status),
      INDEX idx_category    (category),
      INDEX idx_priority    (priority),
      INDEX idx_deleted     (is_deleted),
      INDEX idx_created     (created_at),
      INDEX idx_constituent (constituent_user_id)
  );`,
  `CREATE TABLE IF NOT EXISTS complaint_updates (
      id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
      complaint_id    INT UNSIGNED    NOT NULL,
      type            VARCHAR(100)    NOT NULL DEFAULT 'Status Update',
      title           VARCHAR(255)    NOT NULL,
      note            TEXT            DEFAULT NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      INDEX idx_complaint_updates (complaint_id)
  );`,
  `CREATE TABLE IF NOT EXISTS complaint_media (
      id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
      complaint_id    INT UNSIGNED    NOT NULL,
      media_type      ENUM('photo','video') NOT NULL DEFAULT 'photo',
      file_url        VARCHAR(1000)   NOT NULL,
      caption         VARCHAR(500)    DEFAULT NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      INDEX idx_complaint_media (complaint_id)
  );`,
  `CREATE TABLE IF NOT EXISTS complaint_attachments (
      id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
      complaint_id    INT UNSIGNED    NOT NULL,
      file_name       VARCHAR(255)    NOT NULL,
      file_url        VARCHAR(1000)   NOT NULL,
      file_type       VARCHAR(50)     DEFAULT NULL,
      file_size_kb    INT UNSIGNED    DEFAULT NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      INDEX idx_complaint_attach (complaint_id)
  );`,
  `CREATE TABLE IF NOT EXISTS complaint_team (
      id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
      complaint_id    INT UNSIGNED    NOT NULL,
      admin_user_id   INT UNSIGNED    NOT NULL,
      role_label      VARCHAR(100)    DEFAULT NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id)  REFERENCES complaints(id)   ON DELETE CASCADE,
      FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)  ON DELETE CASCADE,
      UNIQUE KEY uk_complaint_admin (complaint_id, admin_user_id),
      INDEX idx_complaint_team (complaint_id)
  );`,
  `CREATE TABLE IF NOT EXISTS complaint_activity (
      id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
      complaint_id    INT UNSIGNED    NOT NULL,
      text            TEXT            NOT NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      INDEX idx_complaint_activity (complaint_id)
  );`
];

async function run() {
  try {
    for (const q of queries) {
      await pool.query(q);
      console.log('Executed query successfully.');
    }
    console.log('All migrations executed!');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    process.exit();
  }
}

run();
