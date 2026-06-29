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
--  TABLE: local_body_wards
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS local_body_wards (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    local_body_id   INT UNSIGNED    NOT NULL,
    ward_no         VARCHAR(50)     NOT NULL,
    place_name      VARCHAR(150)    NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_ward_local_body (local_body_id, ward_no)
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
    slug            VARCHAR(255)    NOT NULL UNIQUE,
    event_date      DATE            NOT NULL,
    event_time      TIME            NOT NULL,
    event_time_to   TIME            DEFAULT NULL,
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
    slug            VARCHAR(300)    NOT NULL UNIQUE,
    content         LONGTEXT        DEFAULT NULL,
    thumbnail_url   VARCHAR(500)    DEFAULT NULL,
    is_featured     BOOLEAN         NOT NULL DEFAULT 0,
    published_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES media_sections(id) ON DELETE CASCADE,
    INDEX idx_section    (section_id),
    INDEX idx_slug       (slug),
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
    -- Common fields (for both text and video)
    author_name     VARCHAR(150)    DEFAULT NULL,
    designation     VARCHAR(150)    DEFAULT NULL,
    -- Text testimonial fields
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

-- ─────────────────────────────────────────────────────────────
--  TABLE: contact_enquiries
--  Stores all public contact form submissions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_enquiries (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(150)    NOT NULL,
    mobile          VARCHAR(20)     NOT NULL,
    email           VARCHAR(200)    DEFAULT NULL,
    panchayat_id    INT UNSIGNED    DEFAULT NULL,
    category        ENUM('membership','local issues','submit ideas','submit opinions','general')
                                    NOT NULL DEFAULT 'general',
    subject         VARCHAR(255)    DEFAULT NULL,
    message         TEXT            NOT NULL,
    status          ENUM('new','read','resolved')
                                    NOT NULL DEFAULT 'new',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_enq_local_body FOREIGN KEY (panchayat_id)
        REFERENCES local_bodies(id) ON DELETE SET NULL,
    INDEX idx_status    (status),
    INDEX idx_category  (category),
    INDEX idx_created   (created_at)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: message_templates
--  Stores SMS, WhatsApp, and Email templates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL,
    type            ENUM('sms', 'whatsapp', 'email') NOT NULL,
    subject         VARCHAR(255)    DEFAULT NULL,
    header_type     ENUM('none', 'text', 'image', 'video', 'document') DEFAULT 'none',
    header_url      VARCHAR(500)    DEFAULT NULL,
    content         TEXT            NOT NULL,
    buttons_json    JSON            DEFAULT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT 1,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type (type)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: enquiry_communications
--  Stores log of messages sent to enquirers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiry_communications (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    enquiry_id      INT UNSIGNED    NOT NULL,
    template_id     INT UNSIGNED    DEFAULT NULL,
    type            ENUM('sms', 'whatsapp', 'email', 'voice') NOT NULL,
    recipient       VARCHAR(200)    NOT NULL,
    message         TEXT            NOT NULL,
    status          VARCHAR(50)     DEFAULT 'sent',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comm_enquiry FOREIGN KEY (enquiry_id)
        REFERENCES contact_enquiries(id) ON DELETE CASCADE,
    CONSTRAINT fk_comm_template FOREIGN KEY (template_id)
        REFERENCES message_templates(id) ON DELETE SET NULL,
    INDEX idx_enquiry (enquiry_id),
    INDEX idx_template (template_id),
    INDEX idx_type (type)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: enquiry_automations
--  Maps enquiry categories to automatic response templates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiry_automations (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    category        ENUM('membership','local issues','submit ideas','submit opinions','general') NOT NULL,
    template_id     INT UNSIGNED    NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT 1,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_auto_template FOREIGN KEY (template_id)
        REFERENCES message_templates(id) ON DELETE CASCADE,
    UNIQUE KEY uk_category (category)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: campaigns
--  Outreach campaigns targeting enquiry audiences
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
    id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(255)    NOT NULL,
    channel             ENUM('sms','whatsapp','email') NOT NULL,
    status              ENUM('draft','running','completed','failed') NOT NULL DEFAULT 'draft',
    target_category     VARCHAR(100)    DEFAULT NULL,
    target_status       VARCHAR(50)     DEFAULT NULL,
    target_panchayat_id INT UNSIGNED    DEFAULT NULL,
    template_id         INT UNSIGNED    DEFAULT NULL,
    message             TEXT            DEFAULT NULL,
    scheduled_at        DATETIME        DEFAULT NULL,
    sent_count          INT UNSIGNED    NOT NULL DEFAULT 0,
    failed_count        INT UNSIGNED    NOT NULL DEFAULT 0,
    total_count         INT UNSIGNED    NOT NULL DEFAULT 0,
    notes               TEXT            DEFAULT NULL,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_campaign_template FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL,
    INDEX idx_camp_status  (status),
    INDEX idx_camp_channel (channel)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: enquiry_notes
--  Internal admin notes attached to a specific enquiry
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiry_notes (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    enquiry_id  INT UNSIGNED    NOT NULL,
    note        TEXT            NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_note_enquiry FOREIGN KEY (enquiry_id) REFERENCES contact_enquiries(id) ON DELETE CASCADE,
    INDEX idx_note_enquiry (enquiry_id)
);

-- ============================================================
--  MODULE: Impact Metrics
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: impact_metrics
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS impact_metrics (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(255)    NOT NULL,
    value         VARCHAR(100)    NOT NULL,
    icon_name     VARCHAR(50)     NOT NULL DEFAULT 'Activity',
    icon_url      VARCHAR(500)    DEFAULT NULL,
    order_index   INT             NOT NULL DEFAULT 0,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
--  MODULE: Constituency / Kothamangalam Gallery
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: kothamangalam_gallery
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kothamangalam_gallery (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    media_type    ENUM('photo', 'video') NOT NULL,
    video_type    ENUM('upload', 'url') NOT NULL DEFAULT 'upload',
    title         VARCHAR(255)    NOT NULL,
    description   TEXT            DEFAULT NULL,
    file_url      VARCHAR(500)    NOT NULL,
    thumbnail_url VARCHAR(500)    DEFAULT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_media_type (media_type),
    INDEX idx_created (created_at)
);
-- ============================================================
--  MODULE: Projects
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: projects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(255)    NOT NULL,
    slug          VARCHAR(255)    NOT NULL UNIQUE,
    description   TEXT            DEFAULT NULL,
    project_content LONGTEXT      DEFAULT NULL,
    images        JSON            DEFAULT NULL,
    tags          VARCHAR(1000)   DEFAULT NULL,
    year          YEAR            DEFAULT NULL,
    sector_id     INT UNSIGNED    DEFAULT NULL,
    local_body_id INT UNSIGNED    DEFAULT NULL,
    display_order INT             NOT NULL DEFAULT 0,
    is_active     BOOLEAN         NOT NULL DEFAULT 1,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sector_id)     REFERENCES sectors(id)      ON DELETE SET NULL,
    FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE SET NULL,
    INDEX idx_is_active (is_active),
    INDEX idx_year (year)
);

-- ============================================================
--  MODULE: Constituent Auth
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: constituent_users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS constituent_users (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name           VARCHAR(100) NOT NULL,
    phone               VARCHAR(20)  DEFAULT NULL,
    email               VARCHAR(150) NOT NULL UNIQUE,
    password            VARCHAR(255) NOT NULL,
    gender              VARCHAR(20)  DEFAULT NULL,
    panchayat_id        INT UNSIGNED NOT NULL,
    ward_id             INT UNSIGNED NOT NULL,
    house_name          VARCHAR(150) NOT NULL,
    house_number        VARCHAR(50)  NOT NULL,
    constituency        VARCHAR(100) NOT NULL DEFAULT 'Kothamangalam',
    is_active           BOOLEAN      NOT NULL DEFAULT 1,
    last_login          DATETIME     DEFAULT NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (panchayat_id) REFERENCES local_bodies(id),
    FOREIGN KEY (ward_id)      REFERENCES local_body_wards(id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: constituent_password_resets
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS constituent_password_resets (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(150) NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires_at DATETIME     NOT NULL,
    used       BOOLEAN      NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: constituent_email_otps
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS constituent_email_otps (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(150) NOT NULL,
    otp        VARCHAR(10)  NOT NULL,
    expires_at DATETIME     NOT NULL,
    is_verified BOOLEAN     NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

-- Tourism Attractions (admin-managed)
CREATE TABLE IF NOT EXISTS tourism_attractions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    image           VARCHAR(500),
    location        VARCHAR(255),
    category        VARCHAR(100) DEFAULT 'Other',
    map_url         VARCHAR(500),
    opening_time    VARCHAR(10),
    closing_time    VARCHAR(10),
    days_open       JSON,
    published_by    VARCHAR(100) DEFAULT 'MLA Office',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tourism Suggestions (from SuggestPlaceModal — constituent submissions)
CREATE TABLE IF NOT EXISTS tourism_suggestions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    location        VARCHAR(255),
    map_url         VARCHAR(500),
    opening_time    VARCHAR(10),
    closing_time    VARCHAR(10),
    days_open       JSON,
    image_url       VARCHAR(500),
    submitter_name  VARCHAR(255),
    status          ENUM('pending','approved','rejected') DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  MODULE: Complaints (MLA Connect + Admin Panel)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  TABLE: complaints
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaints (
    id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    reference_no        VARCHAR(30)     NOT NULL UNIQUE,
    title               VARCHAR(255)    NOT NULL,
    category            VARCHAR(255)    NOT NULL DEFAULT 'Other',
    priority            ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
    status              ENUM(
                          'Pending','Under Process','Not Attended',
                          'Resolved','Escalated','Draft'
                        ) NOT NULL DEFAULT 'Pending',
    description         TEXT            DEFAULT NULL,
    location            VARCHAR(500)    DEFAULT NULL,
    internal_note       TEXT            DEFAULT NULL,
    -- Complainant info
    complainant_name    VARCHAR(150)    NOT NULL,
    phone               VARCHAR(25)     NOT NULL,
    alternative_phone   VARCHAR(25)     DEFAULT NULL,
    email               VARCHAR(200)    DEFAULT NULL,
    -- Geography
    local_body_id       INT UNSIGNED    DEFAULT NULL,
    ward_id             INT UNSIGNED    DEFAULT NULL,
    -- Department
    department_id       INT UNSIGNED    DEFAULT NULL,
    -- Auth ownership (one or the other is set, not both)
    constituent_user_id INT UNSIGNED    DEFAULT NULL,
    filed_by_admin_id   INT UNSIGNED    DEFAULT NULL,
    -- Soft delete / Trash
    is_deleted          BOOLEAN         NOT NULL DEFAULT 0,
    deleted_at          DATETIME        DEFAULT NULL,
    -- Filing date
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
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: complaint_updates  (progress / timeline entries)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_updates (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    complaint_id    INT UNSIGNED    NOT NULL,
    type            VARCHAR(100)    NOT NULL DEFAULT 'Status Update',
    title           VARCHAR(255)    NOT NULL,
    note            TEXT            DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    INDEX idx_complaint_updates (complaint_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: complaint_media  (evidence gallery photos/videos)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_media (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    complaint_id    INT UNSIGNED    NOT NULL,
    media_type      ENUM('photo','video') NOT NULL DEFAULT 'photo',
    file_url        VARCHAR(1000)   NOT NULL,
    caption         VARCHAR(500)    DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    INDEX idx_complaint_media (complaint_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: complaint_attachments  (supporting documents)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_attachments (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    complaint_id    INT UNSIGNED    NOT NULL,
    file_name       VARCHAR(255)    NOT NULL,
    file_url        VARCHAR(1000)   NOT NULL,
    file_type       VARCHAR(50)     DEFAULT NULL,
    file_size_kb    INT UNSIGNED    DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    INDEX idx_complaint_attach (complaint_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: complaint_team  (follow-up team — admin users only)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_team (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    complaint_id    INT UNSIGNED    NOT NULL,
    admin_user_id   INT UNSIGNED    NOT NULL,
    role_label      VARCHAR(100)    DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id)  REFERENCES complaints(id)   ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)  ON DELETE CASCADE,
    UNIQUE KEY uk_complaint_admin (complaint_id, admin_user_id),
    INDEX idx_complaint_team (complaint_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: complaint_activity  (activity log)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_activity (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    complaint_id    INT UNSIGNED    NOT NULL,
    text            TEXT            NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
    INDEX idx_complaint_activity (complaint_id)
);

-- ─────────────────────────────────────────────────────────────
--  TABLE: complaint_categories
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaint_categories (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255)    NOT NULL UNIQUE,
    status          ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
