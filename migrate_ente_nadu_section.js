import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_ente_nadu_section] Running...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS ente_nadu_section (
                id INT PRIMARY KEY,
                title VARCHAR(20),
                highlight_text VARCHAR(70),
                description TEXT,
                buttons JSON,
                image_url VARCHAR(500),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ ente_nadu_section table created');

        await conn.query(
            `INSERT IGNORE INTO ente_nadu_section (id, title, highlight_text) VALUES (1, 'Ente Nadu', "Ente Nadu is not just an initiative — it's a mission for transformation.")`
        );
        console.log('  ✓ Default row inserted');

        console.log('[migrate_ente_nadu_section] Done.');
    } catch (err) {
        console.error('[migrate_ente_nadu_section] Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
