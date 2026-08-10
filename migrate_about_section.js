import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_about_section] Running...');

        // JSON and TEXT columns cannot have DEFAULT values in MySQL — omit defaults
        await conn.query(`
            CREATE TABLE IF NOT EXISTS about_section (
                id INT PRIMARY KEY,
                title VARCHAR(20),
                description TEXT,
                quote TEXT,
                image_url VARCHAR(500),
                buttons JSON,
                roles JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ about_section table created');

        await conn.query(`INSERT IGNORE INTO about_section (id, title) VALUES (1, 'About')`);
        console.log('  ✓ Default row inserted');

        console.log('[migrate_about_section] Done.');
    } catch (err) {
        console.error('[migrate_about_section] Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
