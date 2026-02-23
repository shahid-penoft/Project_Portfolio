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
        CREATE TABLE IF NOT EXISTS hero_sections (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            welcome_text VARCHAR(255),
            title        VARCHAR(255),
            subtitle     TEXT,
            description  TEXT,
            image_url    VARCHAR(500),
            updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    // Seed with initial data if empty
    const [rows] = await db.query('SELECT COUNT(*) as count FROM hero_sections');
    if (rows[0].count === 0) {
        await db.query(`
            INSERT INTO hero_sections (id, welcome_text, title, subtitle, description, image_url) 
            VALUES (1, 
                'Welcome to our portfolio', 
                'People First. Progress Always..', 
                'Leading Kothamangalam with compassion, vision, and commitment.', 
                'Rooted in the values of justice, transparency, and inclusive development, Shibu Theckumpuram is building a future where every citizen\\'s voice shapes the journey forward.', 
                'https://images.unsplash.com/photo-1521791136064-7986c2923216?auto=format&fit=crop&q=80&w=1000'
            )
        `);
        console.log('✓ hero_sections table seeded with initial data');
    }

    console.log('✓ hero_sections table created');
} catch (e) {
    console.error('hero_sections table error:', e.message);
    process.exit(1);
}

await db.end();
process.exit(0);
