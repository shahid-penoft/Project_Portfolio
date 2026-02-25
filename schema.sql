-- ============================================================
--  DIAVETS DATABASE SCHEMA
--  Module: Admin Authentication
-- ============================================================

CREATE DATABASE IF NOT EXISTS diavets_db;
USE diavets_db;

-- ─────────────────────────────────────────────────────────────
--  TABLE: admin_users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    full_name         VARCHAR(100)    NOT NULL,
    email             VARCHAR(150)    NOT NULL UNIQUE,
    password          VARCHAR(255)    NOT NULL,
    role              ENUM('superadmin', 'admin', 'editor') NOT NULL DEFAULT 'admin',
    profile_image     VARCHAR(500)    DEFAULT NULL,
    is_active         BOOLEAN         NOT NULL DEFAULT 1,
    last_login        DATETIME        DEFAULT NULL,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: password_resets
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
    id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    email             VARCHAR(150)    NOT NULL,
    token             VARCHAR(255)    NOT NULL,
    expires_at        DATETIME        NOT NULL,
    used              BOOLEAN         NOT NULL DEFAULT 0,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email   (email),
    INDEX idx_token   (token)
);

-- ─────────────────────────────────────────────────────────────
--  Seed: Default Super Admin  (Password: Admin@1234)
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO admin_users (full_name, email, password, role)
VALUES (
    'Super Admin',
    'superadmin@diavets.com',
    '$2a$12$o5C9mHXzW1R3K4lQpE7XaO6kD.JVcBJjWEZ5R87.TnF7Yq3RCfRGy',
    'superadmin'
);

-- ============================================================
--  MODULE: Events
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: local_bodies
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS local_bodies (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(150)    NOT NULL UNIQUE,
    description   TEXT            DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: sectors
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sectors (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(150)    NOT NULL UNIQUE,
    description   TEXT            DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: event_types
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_types (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    type_name     VARCHAR(150)    NOT NULL UNIQUE,
    description   TEXT            DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: events
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    event_name      VARCHAR(255)    NOT NULL,
    event_date      DATE            NOT NULL,
    event_time      TIME            NOT NULL,
    venue           VARCHAR(255)    NOT NULL,
    short_description TEXT          DEFAULT NULL,
    status          ENUM('upcoming','ongoing','past') NOT NULL DEFAULT 'upcoming',
    event_type_id   INT UNSIGNED    DEFAULT NULL,
    local_body_id   INT UNSIGNED    DEFAULT NULL,
    sector_id       INT UNSIGNED    DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_type_id)  REFERENCES event_types(id)  ON DELETE SET NULL,
    FOREIGN KEY (local_body_id)  REFERENCES local_bodies(id) ON DELETE SET NULL,
    FOREIGN KEY (sector_id)      REFERENCES sectors(id)      ON DELETE SET NULL,
    INDEX idx_status      (status),
    INDEX idx_event_date  (event_date)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: event_content  (ordered text paragraphs)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_content (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    event_id        INT UNSIGNED    NOT NULL,
    content_order   INT             NOT NULL DEFAULT 0,
    paragraph_text  LONGTEXT        NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_event_content (event_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: event_media  (photos & videos — also powers Gallery)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_media (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    event_id      INT UNSIGNED    NOT NULL,
    media_type    ENUM('photo','video') NOT NULL,
    file_url      VARCHAR(500)    NOT NULL,
    caption       VARCHAR(500)    DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_event_media      (event_id),
    INDEX idx_media_type       (media_type)
);

-- ============================================================
--  MODULE: Media Centre
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: media_sections  (Press Release, Interviews, …)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_sections (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    section_name    VARCHAR(150)    NOT NULL UNIQUE,
    description     TEXT            DEFAULT NULL,
    display_order   INT             NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT 1,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: media_posts
--  is_featured = 1  →  appears in Latest Updates feed
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_posts (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    section_id      INT UNSIGNED    NOT NULL,
    title           VARCHAR(255)    NOT NULL,
    content         LONGTEXT        DEFAULT NULL,
    thumbnail_url   VARCHAR(500)    DEFAULT NULL,
    is_featured     BOOLEAN         NOT NULL DEFAULT 0,
    published_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES media_sections(id) ON DELETE CASCADE,
    INDEX idx_section    (section_id),
    INDEX idx_featured   (is_featured),
    INDEX idx_published  (published_at)
);

-- ─────────────────────────────────────────────────────────────
--  Seed: Default Media Sections
-- ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO media_sections (section_name, description, display_order) VALUES
    ('Press Release', 'Official press releases and statements', 1),
    ('Interviews',    'Media interviews and features',          2);

-- ============================================================
--  MODULE: About Page
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: timelines
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timelines (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    year          VARCHAR(20)     NOT NULL,
    title         TEXT            NOT NULL,
    image_url     VARCHAR(500)    DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: recognitions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recognitions (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    description   TEXT            NOT NULL,
    icon_name     VARCHAR(50)     NOT NULL DEFAULT 'Activity',
    order_index   INT             NOT NULL DEFAULT 0,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
--  MODULE: Ente Nadu Page
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: achievements
--  Achievements & Awards shown on the Ente Nadu page
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(255)    NOT NULL,
    description   TEXT            DEFAULT NULL,
    order_index   INT             NOT NULL DEFAULT 0,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order (order_index)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: ente_nadu_testimonials
--  Text & Video testimonials for the Ente Nadu section
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ente_nadu_testimonials (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    type            ENUM('text','video')  NOT NULL DEFAULT 'text',
    -- Text testimonial fields
    author_name     VARCHAR(150)    DEFAULT NULL,
    house_name      VARCHAR(150)    DEFAULT NULL,
    quote           TEXT            DEFAULT NULL,
    avatar_url      VARCHAR(500)    DEFAULT NULL,
    -- Video testimonial fields
    video_url       VARCHAR(1000)   DEFAULT NULL,
    thumbnail_url   VARCHAR(500)    DEFAULT NULL,
    caption         VARCHAR(300)    DEFAULT NULL,
    -- Common
    order_index     INT             NOT NULL DEFAULT 0,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type  (type),
    INDEX idx_order (order_index)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: manifesto_long_term_commitments
--  Manifesto section — cards shown under "Our Long-Term Commitments"
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manifesto_long_term_commitments (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255)    NOT NULL,
    description TEXT            DEFAULT NULL,
    icon_url    VARCHAR(500)    DEFAULT NULL,
    order_index INT             NOT NULL DEFAULT 0,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order (order_index)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: manifesto_development_goals
--  Manifesto section — cards shown under "Development Goals"
--  Each card has a title (blue heading) + description only
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manifesto_development_goals (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255)    NOT NULL,
    description TEXT            DEFAULT NULL,
    order_index INT             NOT NULL DEFAULT 0,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order (order_index)
);
