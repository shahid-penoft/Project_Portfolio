-- ============================================================
--  MODULE: Issues
-- ============================================================

USE diavets_db;

-- ─────────────────────────────────────────────────────────────
--  TABLE: issues
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issues (
    id                    INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    reference_no          VARCHAR(50)     NOT NULL UNIQUE,
    title                 VARCHAR(255)    NOT NULL,
    category              VARCHAR(150)    NOT NULL DEFAULT 'Report an Issue',
    priority              ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
    status                ENUM('Pending', 'Under Process', 'Not Attended', 'Resolved', 'Escalated') NOT NULL DEFAULT 'Pending',
    description           LONGTEXT        DEFAULT NULL,
    location              VARCHAR(255)    DEFAULT NULL,
    internal_note         TEXT            DEFAULT NULL,
    
    submitter_name        VARCHAR(150)    NOT NULL,
    phone                 VARCHAR(25)     NOT NULL,
    alternative_phone     VARCHAR(25)     DEFAULT NULL,
    email                 VARCHAR(150)    DEFAULT NULL,
    
    local_body_id         INT UNSIGNED    DEFAULT NULL,
    ward_id               INT UNSIGNED    DEFAULT NULL,
    department_id         INT UNSIGNED    DEFAULT NULL,
    
    constituent_user_id   INT UNSIGNED    DEFAULT NULL,
    filed_by_admin_id     INT UNSIGNED    DEFAULT NULL,
    
    date_filed            DATE            NOT NULL,
    is_deleted            BOOLEAN         NOT NULL DEFAULT 0,
    deleted_at            DATETIME        DEFAULT NULL,
    
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (local_body_id)       REFERENCES local_bodies(id) ON DELETE SET NULL,
    FOREIGN KEY (ward_id)             REFERENCES local_body_wards(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id)       REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (constituent_user_id) REFERENCES constituent_users(id) ON DELETE SET NULL,
    FOREIGN KEY (filed_by_admin_id)   REFERENCES admin_users(id) ON DELETE SET NULL,
    
    INDEX idx_reference  (reference_no),
    INDEX idx_status     (status),
    INDEX idx_priority   (priority)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: issue_updates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_updates (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    issue_id      INT UNSIGNED    NOT NULL,
    type          VARCHAR(100)    NOT NULL DEFAULT 'Status Update',
    title         VARCHAR(255)    NOT NULL,
    note          TEXT            DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    INDEX idx_issue_updates (issue_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: issue_media
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_media (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    issue_id      INT UNSIGNED    NOT NULL,
    media_type    ENUM('photo', 'video') NOT NULL DEFAULT 'photo',
    file_url      VARCHAR(500)    NOT NULL,
    caption       VARCHAR(500)    DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    INDEX idx_issue_media (issue_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: issue_attachments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_attachments (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    issue_id      INT UNSIGNED    NOT NULL,
    file_name     VARCHAR(255)    NOT NULL,
    file_url      VARCHAR(500)    NOT NULL,
    file_type     VARCHAR(50)     DEFAULT NULL,
    file_size_kb  INT UNSIGNED    DEFAULT 0,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    INDEX idx_issue_attach (issue_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: issue_team
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_team (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    issue_id        INT UNSIGNED    NOT NULL,
    admin_user_id   INT UNSIGNED    NOT NULL,
    role_label      VARCHAR(100)    DEFAULT 'Support',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id)      REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_issue_member (issue_id, admin_user_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: issue_activity
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS issue_activity (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    issue_id        INT UNSIGNED    NOT NULL,
    text            TEXT            NOT NULL,
    admin_user_id   INT UNSIGNED    DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id)      REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
    INDEX idx_issue_activity (issue_id)
);
