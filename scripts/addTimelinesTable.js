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

try {
    await db.query(`
        CREATE TABLE IF NOT EXISTS timelines (
            id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
            year          VARCHAR(20)     NOT NULL,
            title         TEXT            NOT NULL,
            image_url     VARCHAR(500)    DEFAULT NULL,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    console.log('✓ timelines table created (or already exists)');
} catch (e) {
    console.error('timelines table error:', e.message);
    process.exit(1);
}

await db.end();
process.exit(0);
