import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    multipleStatements: true,
};

async function migrate() {
    console.log('🔌  Connecting to database...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅  Connected.\n');

        // ── 1. csr_organisations ──────────────────────────────────────
        console.log('📋  Creating csr_organisations...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS csr_organisations (
                id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                name                VARCHAR(255)    NOT NULL,
                type                VARCHAR(50)     DEFAULT NULL COMMENT 'Corporate|NGO|Public Sector|PSU|Trust/NGO|MSME|Other',
                responsible_person  VARCHAR(255)    DEFAULT NULL,
                phone               VARCHAR(50)     DEFAULT NULL,
                email               VARCHAR(255)    DEFAULT NULL,
                domains             JSON            DEFAULT NULL COMMENT 'Array of domain strings',
                contribution        BIGINT          DEFAULT 0   COMMENT 'Total pledged rupees',
                status              VARCHAR(50)     DEFAULT 'Active' COMMENT 'Active|In Discussion|Proposal Sent|Approved|Funding Received|Project Running|Completed|Inactive',
                district            VARCHAR(100)    DEFAULT NULL,
                registration_no     VARCHAR(100)    DEFAULT NULL,
                website             VARCHAR(255)    DEFAULT NULL,
                office_address      TEXT            DEFAULT NULL,
                annual_budget       BIGINT          DEFAULT NULL,
                assigned_to         VARCHAR(255)    DEFAULT NULL,
                next_followup       DATE            DEFAULT NULL,
                last_followup       DATE            DEFAULT NULL,
                internal_notes      TEXT            DEFAULT NULL,
                deleted             TINYINT(1)      NOT NULL DEFAULT 0,
                deleted_at          DATETIME        DEFAULT NULL,
                deleted_by          INT UNSIGNED    DEFAULT NULL,
                created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_csr_org_deleted   (deleted),
                INDEX idx_csr_org_status    (status),
                INDEX idx_csr_org_district  (district)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('   ✅  csr_organisations created.');

        // ── 2. csr_organisation_contacts ─────────────────────────────
        console.log('📋  Creating csr_organisation_contacts...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS csr_organisation_contacts (
                id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                org_id          INT UNSIGNED    NOT NULL,
                name            VARCHAR(255)    DEFAULT NULL,
                phone           VARCHAR(50)     DEFAULT NULL,
                email           VARCHAR(255)    DEFAULT NULL,
                designation     VARCHAR(100)    DEFAULT NULL,
                created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (org_id) REFERENCES csr_organisations(id) ON DELETE CASCADE,
                INDEX idx_csr_contact_org (org_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('   ✅  csr_organisation_contacts created.');

        // ── 3. csr_followups ─────────────────────────────────────────
        console.log('📋  Creating csr_followups...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS csr_followups (
                id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                org_id              INT UNSIGNED    NOT NULL,
                org_name            VARCHAR(255)    DEFAULT NULL,
                date                DATE            NOT NULL,
                type                VARCHAR(20)     DEFAULT 'Call' COMMENT 'Call|Meeting|Email',
                status              VARCHAR(20)     DEFAULT 'Scheduled' COMMENT 'Scheduled|Completed|Cancelled',
                notes               TEXT            DEFAULT NULL,
                sent_by             VARCHAR(255)    DEFAULT NULL,
                notify_email        TINYINT(1)      DEFAULT 0,
                notify_sms          TINYINT(1)      DEFAULT 0,
                notify_whatsapp     TINYINT(1)      DEFAULT 0,
                initials            VARCHAR(5)      DEFAULT NULL,
                created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (org_id) REFERENCES csr_organisations(id) ON DELETE CASCADE,
                INDEX idx_csr_followup_org  (org_id),
                INDEX idx_csr_followup_date (date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('   ✅  csr_followups created.');

        // ── 4. csr_activities ─────────────────────────────────────────
        console.log('📋  Creating csr_activities...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS csr_activities (
                id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                user_name   VARCHAR(255)    DEFAULT NULL,
                action      TEXT            NOT NULL,
                time_label  VARCHAR(100)    DEFAULT NULL,
                initials    VARCHAR(5)      DEFAULT NULL,
                created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_csr_activity_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('   ✅  csr_activities created.');

        // ── 5. csr_reports ────────────────────────────────────────────
        console.log('📋  Creating csr_reports...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS csr_reports (
                id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                org_id              INT UNSIGNED    DEFAULT NULL,
                org_name            VARCHAR(255)    DEFAULT NULL,
                type                VARCHAR(50)     NOT NULL,
                title               VARCHAR(255)    NOT NULL,
                sent_by             VARCHAR(255)    DEFAULT NULL,
                sent_by_id          VARCHAR(50)     DEFAULT NULL,
                message             LONGTEXT        DEFAULT NULL,
                special_notes       TEXT            DEFAULT NULL,
                status              VARCHAR(20)     DEFAULT 'Sent' COMMENT 'Sent|Scheduled',
                scheduled_at        DATETIME        DEFAULT NULL,
                date_sent           DATE            DEFAULT NULL,
                time_sent           VARCHAR(20)     DEFAULT NULL,
                projects_count      INT             DEFAULT 0,
                orgs_count          INT             DEFAULT 0,
                recipients_count    INT             DEFAULT 0,
                attachments_count   INT             DEFAULT 0,
                projects_list       JSON            DEFAULT NULL,
                org_list            JSON            DEFAULT NULL,
                recipient_list      JSON            DEFAULT NULL,
                attachment_list     JSON            DEFAULT NULL,
                created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (org_id) REFERENCES csr_organisations(id) ON DELETE SET NULL,
                INDEX idx_csr_report_org    (org_id),
                INDEX idx_csr_report_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('   ✅  csr_reports created.');

        // ── 6. csr_report_attachments ─────────────────────────────────
        console.log('📋  Creating csr_report_attachments...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS csr_report_attachments (
                id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                report_id   INT UNSIGNED    NOT NULL,
                file_name   VARCHAR(255)    DEFAULT NULL,
                file_url    TEXT            DEFAULT NULL,
                file_size   INT             DEFAULT NULL,
                file_ext    VARCHAR(20)     DEFAULT NULL,
                created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (report_id) REFERENCES csr_reports(id) ON DELETE CASCADE,
                INDEX idx_csr_attach_report (report_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('   ✅  csr_report_attachments created.');

        // ── 7. csr_project_links (bridge) ─────────────────────────────
        console.log('📋  Creating csr_project_links...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS csr_project_links (
                id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                csr_org_id          INT UNSIGNED    NOT NULL,
                project_id          INT             NOT NULL,
                allocated_amount    BIGINT          DEFAULT 0,
                spent_amount        BIGINT          DEFAULT 0,
                status              VARCHAR(20)     DEFAULT 'Proposal' COMMENT 'Proposal|Active|Completed|On Hold',
                notes               TEXT            DEFAULT NULL,
                created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (csr_org_id) REFERENCES csr_organisations(id) ON DELETE CASCADE,
                UNIQUE KEY uk_csr_project (csr_org_id, project_id),
                INDEX idx_csr_link_org      (csr_org_id),
                INDEX idx_csr_link_project  (project_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('   ✅  csr_project_links created.');

        // ── 8. ALTER project_budget_allocations — add csr_org_id ──────
        console.log('🔧  Altering project_budget_allocations (add csr_org_id)...');
        const [allocCols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_budget_allocations' AND COLUMN_NAME = 'csr_org_id'
        `);
        if (allocCols.length === 0) {
            await connection.query(`
                ALTER TABLE project_budget_allocations
                ADD COLUMN csr_org_id INT UNSIGNED DEFAULT NULL AFTER fund_source,
                ADD CONSTRAINT fk_pba_csr_org FOREIGN KEY (csr_org_id) REFERENCES csr_organisations(id) ON DELETE SET NULL;
            `);
            console.log('   ✅  csr_org_id added to project_budget_allocations.');
        } else {
            console.log('   ⏭️   csr_org_id already exists in project_budget_allocations, skipping.');
        }

        // ── 9. ALTER project_budget_entries — add csr_org_id ──────────
        console.log('🔧  Altering project_budget_entries (add csr_org_id)...');
        const [entryCols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_budget_entries' AND COLUMN_NAME = 'csr_org_id'
        `);
        if (entryCols.length === 0) {
            await connection.query(`
                ALTER TABLE project_budget_entries
                ADD COLUMN csr_org_id INT UNSIGNED DEFAULT NULL AFTER project_id,
                ADD CONSTRAINT fk_pbe_csr_org FOREIGN KEY (csr_org_id) REFERENCES csr_organisations(id) ON DELETE SET NULL;
            `);
            console.log('   ✅  csr_org_id added to project_budget_entries.');
        } else {
            console.log('   ⏭️   csr_org_id already exists in project_budget_entries, skipping.');
        }

        console.log('\n🎉  All CSR migrations completed successfully!');
    } catch (error) {
        console.error('\n❌  Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
