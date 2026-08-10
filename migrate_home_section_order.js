import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_home_section_order] Running...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS home_section_order (
                section_id VARCHAR(50) PRIMARY KEY,
                order_index INT NOT NULL DEFAULT 0,
                visibility ENUM('both','portfolio','mlaconnect') DEFAULT 'both',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✓ home_section_order table created');

        // Insert default section order
        const defaults = [
            ['hero', 0],
            ['about', 1],
            ['core-vision', 2],
            ['ente-nadu', 3],
        ];
        for (const [sectionId, orderIndex] of defaults) {
            await conn.query(
                `INSERT IGNORE INTO home_section_order (section_id, order_index) VALUES (?, ?)`,
                [sectionId, orderIndex]
            );
        }
        console.log('  ✓ Default section order rows inserted');

        console.log('[migrate_home_section_order] Done.');
    } catch (err) {
        console.error('[migrate_home_section_order] Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
