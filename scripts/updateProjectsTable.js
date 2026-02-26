import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const db = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
});

async function migrate() {
    try {
        console.log('Adding project_content column to projects table...');
        await db.query(`ALTER TABLE projects ADD COLUMN project_content LONGTEXT AFTER description;`);
        console.log('✓ column project_content added successfully.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('✓ column project_content already exists.');
        } else {
            console.error('Migration error:', e.message);
            process.exit(1);
        }
    } finally {
        await db.end();
    }
}

migrate();
