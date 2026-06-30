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

        console.log('Creating project_budget_allocations table...');

        const tablesSql = `
        CREATE TABLE IF NOT EXISTS project_budget_allocations (
          id           INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
          project_id   INT            NOT NULL,
          fund_source  VARCHAR(150)   DEFAULT NULL,
          category     VARCHAR(150)   NOT NULL,
          amount       DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
          period       VARCHAR(50)    DEFAULT NULL,
          created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          INDEX idx_proj_budget_alloc (project_id)
        );
        `;

        await connection.query(tablesSql);
        console.log('Successfully created project_budget_allocations table.');

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
