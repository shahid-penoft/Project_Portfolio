import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function createVisualStoriesTable() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        const query = `
            CREATE TABLE IF NOT EXISTS visual_stories (
                id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                title         VARCHAR(255)    NOT NULL,
                description   TEXT,
                video_type    ENUM('url', 'upload') DEFAULT 'url',
                video_url     TEXT            NOT NULL,
                thumbnail_url TEXT,
                order_index   INT             NOT NULL DEFAULT 0,
                created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `;

        console.log('Creating visual_stories table...');
        await connection.execute(query);
        console.log('visual_stories table created successfully.');

    } catch (error) {
        console.error('Error creating visual_stories table:', error);
    } finally {
        await connection.end();
    }
}

createVisualStoriesTable();
