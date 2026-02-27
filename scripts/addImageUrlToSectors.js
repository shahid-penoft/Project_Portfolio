/**
 * scripts/addImageUrlToSectors.js
 * Adds image_url column to the sectors table.
 */
import db from '../configs/db.js';

async function run() {
    try {
        console.log('Checking for image_url column in sectors table...');
        const [cols] = await db.query(`SHOW COLUMNS FROM sectors LIKE 'image_url'`);

        if (cols.length > 0) {
            console.log('✅  image_url column already exists. Nothing to do.');
            process.exit(0);
        }

        await db.query(`ALTER TABLE sectors ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER description`);
        console.log('✅  Added image_url column to sectors table.');
        process.exit(0);
    } catch (err) {
        console.error('❌  Migration failed:', err.message);
        process.exit(1);
    }
}

run();
