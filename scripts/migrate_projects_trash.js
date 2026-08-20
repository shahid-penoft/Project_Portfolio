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
        console.log('Migrating projects table for soft delete / trash support...');

        // 1. Add is_deleted
        try {
            await db.query(`ALTER TABLE projects ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0;`);
            console.log('✓ column is_deleted added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column is_deleted already exists.');
            else throw e;
        }

        // 2. Add deleted_at
        try {
            await db.query(`ALTER TABLE projects ADD COLUMN deleted_at DATETIME DEFAULT NULL;`);
            console.log('✓ column deleted_at added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column deleted_at already exists.');
            else throw e;
        }

        // 3. Add deleted_by
        try {
            await db.query(`ALTER TABLE projects ADD COLUMN deleted_by INT UNSIGNED DEFAULT NULL;`);
            console.log('✓ column deleted_by added.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('✓ column deleted_by already exists.');
            else throw e;
        }

        // 4. Add Indexes
        try {
            await db.query(`ALTER TABLE projects ADD INDEX idx_projects_is_deleted (is_deleted);`);
            console.log('✓ index idx_projects_is_deleted added.');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') console.log('✓ index idx_projects_is_deleted already exists.');
        }

        try {
            await db.query(`ALTER TABLE projects ADD INDEX idx_projects_deleted_at (deleted_at);`);
            console.log('✓ index idx_projects_deleted_at added.');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') console.log('✓ index idx_projects_deleted_at already exists.');
        }

        console.log('✅ Projects trash migration complete.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

migrate();
