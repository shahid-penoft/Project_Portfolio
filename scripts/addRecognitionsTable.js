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
        CREATE TABLE IF NOT EXISTS recognitions (
            id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
            description   TEXT            NOT NULL,
            icon_name     VARCHAR(50)     NOT NULL DEFAULT 'Activity',
            order_index   INT             NOT NULL DEFAULT 0,
            created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    console.log('✓ recognitions table created (or already exists)');
} catch (e) {
    console.error('recognitions table error:', e.message);
    process.exit(1);
}

await db.end();
process.exit(0);
