/**
 * scripts/addDisplayOrderToSectors.js
 * Adds display_order column to the sectors table.
 */
import db from '../configs/db.js';

async function run() {
    try {
        console.log('Checking for display_order column in sectors table...');
        const [cols] = await db.query(`SHOW COLUMNS FROM sectors LIKE 'display_order'`);

        if (cols.length > 0) {
            console.log('✅  display_order column already exists. Nothing to do.');
            process.exit(0);
        }

        await db.query(`ALTER TABLE sectors ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER image_url`);
        console.log('✅  Added display_order column to sectors table.');

        // Initialize display_order based on current id order
        await db.query(`
            UPDATE sectors s
            JOIN (
                SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) - 1 AS rn FROM sectors
            ) ranked ON s.id = ranked.id
            SET s.display_order = ranked.rn
        `);
        console.log('✅  Initialized display_order values.');
        process.exit(0);
    } catch (err) {
        console.error('❌  Migration failed:', err.message);
        process.exit(1);
    }
}

run();
