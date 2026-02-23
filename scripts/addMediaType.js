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
    await db.query(`ALTER TABLE media_sections ADD COLUMN media_type ENUM('article','video','mixed') NOT NULL DEFAULT 'article'`);
    console.log('✓ media_sections.media_type added');
} catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ media_sections.media_type already exists — skipped');
    else { console.error('media_sections error:', e.message); process.exit(1); }
}

try {
    await db.query(`ALTER TABLE media_posts ADD COLUMN video_url VARCHAR(500) NULL DEFAULT NULL`);
    console.log('✓ media_posts.video_url added');
} catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ media_posts.video_url already exists — skipped');
    else { console.error('media_posts error:', e.message); process.exit(1); }
}

await db.end();
process.exit(0);

