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
        CREATE TABLE IF NOT EXISTS projects (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            title         VARCHAR(255)  NOT NULL,
            description   TEXT,
            images        JSON,
            tags          VARCHAR(1000),
            year          YEAR,
            sector_id     INT           DEFAULT NULL,
            local_body_id INT           DEFAULT NULL,
            display_order INT           DEFAULT 0,
            is_active     TINYINT(1)    DEFAULT 1,
            created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (sector_id)     REFERENCES sectors(id)      ON DELETE SET NULL,
            FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE SET NULL
        )
    `);
    console.log('✓ projects table created (or already exists)');
} catch (e) {
    console.error('projects table error:', e.message);
    process.exit(1);
}

await db.end();
process.exit(0);
