import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_core_vision_section] Running...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS core_vision_section (
                id INT PRIMARY KEY,
                title VARCHAR(20),
                description TEXT,
                quote VARCHAR(150),
                buttons JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ core_vision_section table created');

        await conn.query(`INSERT IGNORE INTO core_vision_section (id, title, quote) VALUES (1, 'Core Visions', 'Empowering People.\nElevating Possibilities.')`);
        console.log('  ✓ Default row inserted');

        console.log('[migrate_core_vision_section] Done.');
    } catch (err) {
        console.error('[migrate_core_vision_section] Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
