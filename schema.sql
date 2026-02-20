-- ============================================================
--  DIAVETS DATABASE SCHEMA
--  Module: Admin Authentication
-- ============================================================

CREATE DATABASE IF NOT EXISTS diavets_db;
USE diavets_db;

-- ─────────────────────────────────────────────────────────────
--  TABLE: admin_users
--  Stores all admin accounts with role-based access
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    full_name         VARCHAR(100)    NOT NULL,
    email             VARCHAR(150)    NOT NULL UNIQUE,
    password          VARCHAR(255)    NOT NULL,
    role              ENUM('superadmin', 'admin', 'editor') NOT NULL DEFAULT 'admin',
    profile_image     VARCHAR(500)    DEFAULT NULL,
    is_active         TINYINT(1)      NOT NULL DEFAULT 1,
    last_login        DATETIME        DEFAULT NULL,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: password_resets
--  Stores OTP / tokens for forgot password flow
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
    id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    email             VARCHAR(150)    NOT NULL,
    token             VARCHAR(255)    NOT NULL,
    expires_at        DATETIME        NOT NULL,
    used              TINYINT(1)      NOT NULL DEFAULT 0,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email   (email),
    INDEX idx_token   (token)
);

-- ─────────────────────────────────────────────────────────────
--  Seed: Default Super Admin
--  Password: Admin@1234  (bcrypt hash — change after first login)
-- ─────────────────────────────────────────────────────────────
INSERT INTO admin_users (full_name, email, password, role)
VALUES (
    'Super Admin',
    'shahidomer06@gmail.com',
    '$2a$12$o5C9mHXzW1R3K4lQpE7XaO6kD.JVcBJjWEZ5R87.TnF7Yq3RCfRGy',
    'superadmin'
);
