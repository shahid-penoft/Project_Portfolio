import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database.');

    try {
        // Drop settings table if it exists (Cleanup)
        await connection.query('DROP TABLE IF EXISTS core_vision_settings');
        console.log('Table "core_vision_settings" removed.');

        // 1. Create pillars table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS core_vision_pillars (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                image_url VARCHAR(255),
                order_index INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('Table "core_vision_pillars" verified/created.');

        // 2. Seed pillars if empty
        const [pillarRows] = await connection.query('SELECT COUNT(*) as count FROM core_vision_pillars');
        if (pillarRows[0].count === 0) {
            const initialPillars = [
                ['Inclusive Growth for All', 'Championing opportunities that uplift the underrepresented, especially in rural and economically weaker communities.', null],
                ['Empowered Women.', "Driving women's financial independence, safety, and leadership through structured programs and support ecosystems.", null],
                ['Youth as Catalysts', 'Investing in education, entrepreneurship, and platforms for young voices to lead change.', null],
                ['Social Welfare with Impact', 'Strengthening access to education, health, housing, and livelihood through scalable and ethical initiatives.', null]
            ];

            await connection.query(
                'INSERT INTO core_vision_pillars (title, description, image_url, order_index) VALUES ?',
                [initialPillars.map((p, i) => [...p, i])]
            );
            console.log('Seeded initial Core Vision pillars.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
