import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Configure __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diavets_db',
    multipleStatements: true
};

async function migrate() {
    console.log('Connecting to database...');
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');
        
        console.log('Altering projects table...');
        try {
            await connection.execute(`
                ALTER TABLE projects
                  ADD COLUMN ward_id        INT UNSIGNED   DEFAULT NULL                       AFTER local_body_id,
                  ADD COLUMN status         VARCHAR(50)    NOT NULL DEFAULT 'In Progress'   AFTER is_active,
                  ADD COLUMN start_date     DATE           DEFAULT NULL,
                  ADD COLUMN end_date       DATE           DEFAULT NULL,
                  ADD COLUMN actual_start_date DATE        DEFAULT NULL,
                  ADD COLUMN actual_end_date   DATE        DEFAULT NULL,
                  ADD COLUMN location       VARCHAR(500)   DEFAULT NULL,
                  ADD COLUMN departments    JSON           DEFAULT NULL,
                  ADD COLUMN budget         DECIMAL(15,2)  DEFAULT 0.00,
                  ADD COLUMN spent          DECIMAL(15,2)  DEFAULT 0.00,
                  ADD CONSTRAINT fk_projects_ward FOREIGN KEY (ward_id)
                    REFERENCES local_body_wards(id) ON DELETE SET NULL;
            `);
            console.log('Altered projects table successfully.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Columns already exist in projects table, skipping alter.');
            } else {
                throw e;
            }
        }
        
        console.log('Creating new project tables...');
        
        const tablesSql = `
        CREATE TABLE IF NOT EXISTS project_milestones (
          id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          project_id   INT           NOT NULL,
          title        VARCHAR(255)  NOT NULL,
          status       ENUM('Pending','Active','Done') NOT NULL DEFAULT 'Pending',
          target_date  DATE          DEFAULT NULL,
          display_order INT          NOT NULL DEFAULT 0,
          created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          INDEX idx_proj_milestone (project_id)
        );

        CREATE TABLE IF NOT EXISTS project_updates (
          id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          project_id   INT           NOT NULL,
          type         VARCHAR(100)  NOT NULL,
          title        VARCHAR(255)  NOT NULL,
          note         TEXT          NOT NULL,
          created_by   INT UNSIGNED  DEFAULT NULL,
          created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id)  REFERENCES projects(id)     ON DELETE CASCADE,
          FOREIGN KEY (created_by)  REFERENCES admin_users(id)  ON DELETE SET NULL,
          INDEX idx_proj_update (project_id)
        );

        CREATE TABLE IF NOT EXISTS project_update_media (
          id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          update_id     INT UNSIGNED  NOT NULL,
          media_type    ENUM('photo','video','attachment') NOT NULL,
          file_url      VARCHAR(500)  NOT NULL,
          file_name     VARCHAR(255)  DEFAULT NULL,
          file_size     VARCHAR(50)   DEFAULT NULL,
          created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (update_id) REFERENCES project_updates(id) ON DELETE CASCADE,
          INDEX idx_update_media (update_id)
        );

        CREATE TABLE IF NOT EXISTS project_attachments (
          id           INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          project_id   INT           NOT NULL,
          name         VARCHAR(255)  NOT NULL,
          file_url     VARCHAR(500)  NOT NULL,
          file_size    VARCHAR(50)   DEFAULT NULL,
          file_type    VARCHAR(50)   DEFAULT NULL,
          uploaded_by  INT UNSIGNED  DEFAULT NULL,
          created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id)  REFERENCES projects(id)     ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES admin_users(id)  ON DELETE SET NULL,
          INDEX idx_proj_attach (project_id)
        );

        CREATE TABLE IF NOT EXISTS project_budget_entries (
          id           INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
          project_id   INT            NOT NULL,
          category     VARCHAR(150)   NOT NULL,
          amount       DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
          period       VARCHAR(50)    DEFAULT NULL,
          created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          INDEX idx_proj_budget (project_id)
        );

        CREATE TABLE IF NOT EXISTS project_contractors (
          id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          project_id      INT           NOT NULL,
          name            VARCHAR(255)  NOT NULL,
          contact_person  VARCHAR(150)  DEFAULT NULL,
          role            VARCHAR(150)  DEFAULT NULL,
          phone           VARCHAR(30)   DEFAULT NULL,
          email           VARCHAR(150)  DEFAULT NULL,
          description     TEXT          DEFAULT NULL,
          created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          INDEX idx_proj_contractor (project_id)
        );

        CREATE TABLE IF NOT EXISTS project_team_members (
          id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          project_id     INT           NOT NULL,
          admin_user_id  INT UNSIGNED  NOT NULL,
          assigned_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id)    REFERENCES projects(id)     ON DELETE CASCADE,
          FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)  ON DELETE CASCADE,
          UNIQUE KEY uq_proj_user (project_id, admin_user_id),
          INDEX idx_proj_team (project_id)
        );

        CREATE TABLE IF NOT EXISTS project_activity_logs (
          id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
          project_id     INT           NOT NULL,
          admin_user_id  INT UNSIGNED  DEFAULT NULL,
          text           TEXT          NOT NULL,
          created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id)    REFERENCES projects(id)     ON DELETE CASCADE,
          FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)  ON DELETE SET NULL,
          INDEX idx_proj_log (project_id)
        );
        `;
        
        await connection.query(tablesSql);
        console.log('Successfully created all missing project tables.');
        
        console.log('Migration complete!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

migrate();
