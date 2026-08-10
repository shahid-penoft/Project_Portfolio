import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_home_stats] Running...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS home_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                value VARCHAR(30) NOT NULL,
                label VARCHAR(60) NOT NULL,
                order_index INT DEFAULT 0
            )
        `);
        console.log('  ✓ home_stats table created');

        // Only seed if empty
        const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM home_stats');
        if (cnt === 0) {
            await conn.query(`
                INSERT INTO home_stats (value, label, order_index) VALUES
                ('1,79,000+', 'Voters', 0),
                ('8', 'Panchayats', 1),
                ('1', 'Municipality', 2),
                ('187', 'Booths', 3),
                ('30+', 'Successful initiatives', 4)
            `);
            console.log('  ✓ Default stats seeded');
        } else {
            console.log('  ✓ home_stats already has data, skipping seed');
        }

        console.log('[migrate_home_stats] Done.');
    } catch (err) {
        console.error('[migrate_home_stats] Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
