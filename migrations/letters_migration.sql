-- ─────────────────────────────────────────────────────────────
-- Letters Module DB Migration
-- Run once against the project database
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mla_letters (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  letter_id             VARCHAR(30)  NOT NULL UNIQUE,
  subject               TEXT         NOT NULL,
  type                  ENUM('Request','Recommendation','Appreciation',
                             'Grievance Forwarding','NOC / Certificate',
                             'Circular','Notice','Official Communication','Other') NOT NULL,
  priority              ENUM('Normal','Urgent','Confidential') NOT NULL DEFAULT 'Normal',
  status                ENUM('Draft','Sent','Delivered','Archived')  NOT NULL DEFAULT 'Draft',
  response_status       ENUM('Pending','Acknowledged','Response Received','No Response Required')
                             NOT NULL DEFAULT 'Pending',
  recipient_name        VARCHAR(255) NOT NULL,
  recipient_designation VARCHAR(255),
  recipient_org         VARCHAR(255),
  recipient_address     TEXT,
  recipient_email       VARCHAR(255),
  reference             VARCHAR(100),
  salutation            VARCHAR(100) DEFAULT 'Respected Sir,',
  closing               VARCHAR(100) DEFAULT 'Yours faithfully,',
  body                  LONGTEXT,
  tags                  JSON,
  prepared_by_user_id   INT UNSIGNED,
  prepared_on           DATETIME    DEFAULT CURRENT_TIMESTAMP,
  sent_on               DATETIME,
  year_seq              INT         NOT NULL DEFAULT 0,
  created_at            DATETIME    DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (prepared_by_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mla_letter_followups (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  letter_id           INT NOT NULL,
  type                ENUM('Call','Email','Meeting','Site Visit','In Person') NOT NULL DEFAULT 'Call',
  status              ENUM('Scheduled','In Progress','Completed','Pending') NOT NULL DEFAULT 'Scheduled',
  date                DATE NOT NULL,
  notes               TEXT,
  assigned_to_user_id INT UNSIGNED,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (letter_id)           REFERENCES mla_letters(id)  ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_user_id) REFERENCES admin_users(id)  ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mla_letter_activity (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  letter_id   INT NOT NULL,
  author_name VARCHAR(100),
  author_id   INT UNSIGNED,
  text        TEXT NOT NULL,
  time        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (letter_id) REFERENCES mla_letters(id) ON DELETE CASCADE
);
