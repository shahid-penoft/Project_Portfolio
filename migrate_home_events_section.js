import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_home_events_section] Running...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS home_events_section (
                id INT PRIMARY KEY DEFAULT 1,
                title VARCHAR(100) NOT NULL DEFAULT 'Upcoming Events',
                description TEXT,
                button_text VARCHAR(50) DEFAULT 'View All Events',
                button_url VARCHAR(255) DEFAULT '/events',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ home_events_section table created');

        // Insert default row if not exists
        await conn.query(`
            INSERT IGNORE INTO home_events_section (id, title, description, button_text, button_url)
            VALUES (1, 'Upcoming Events', 'Join events, community meetings, and campaigns that shape the future of Kothamangalam.', 'View All Events', '/events')
        `);
        console.log('  ✓ Default home events section row ensured');

        // Also ensure all 10 sections exist in home_section_order
        const allSections = [
            ['hero', 0, 'both'],
            ['about', 1, 'both'],
            ['kothamangalam', 2, 'both'],
            ['core-vision', 3, 'both'],
            ['events', 4, 'both'],
            ['numbers-speaks', 5, 'both'],
            ['ente-nadu', 6, 'both'],
            ['gallery', 7, 'both'],
            ['contact', 8, 'both'],
            ['mla-connect', 9, 'both'],
        ];

        for (const [secId, ordIdx, vis] of allSections) {
            await conn.query(`
                INSERT INTO home_section_order (section_id, order_index, visibility)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE order_index = order_index
            `, [secId, ordIdx, vis]);
        }
        console.log('  ✓ Ensured all 10 sections seeded in home_section_order');

        console.log('[migrate_home_events_section] Done.');
    } catch (err) {
        console.error('[migrate_home_events_section] Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
