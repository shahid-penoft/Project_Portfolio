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
        
        console.log('Altering projects table to add project_type...');
        try {
            await connection.execute(`
                ALTER TABLE projects 
                ADD COLUMN project_type ENUM('MLA', 'PORTFOLIO') NOT NULL DEFAULT 'MLA' AFTER title;
            `);
            console.log('Altered projects table successfully.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column project_type already exists in projects table, skipping alter.');
            } else {
                throw e;
            }
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (connection) await connection.end();
        console.log('Database connection closed.');
    }
}

migrate();
