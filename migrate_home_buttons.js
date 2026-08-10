import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_home_buttons] Running migrations...');

        // Check if buttons column exists
        const [buttonsCheck] = await conn.query(`
            SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hero_sections' AND COLUMN_NAME = 'buttons'
        `);
        if (buttonsCheck[0].cnt === 0) {
            await conn.query(`ALTER TABLE hero_sections ADD COLUMN buttons JSON`);
            console.log('  ✓ hero_sections.buttons column added');
        } else {
            console.log('  ✓ hero_sections.buttons already exists, skipping');
        }

        // Check if alt_text column exists
        const [altCheck] = await conn.query(`
            SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hero_sections' AND COLUMN_NAME = 'alt_text'
        `);
        if (altCheck[0].cnt === 0) {
            await conn.query(`ALTER TABLE hero_sections ADD COLUMN alt_text VARCHAR(150)`);
            console.log('  ✓ hero_sections.alt_text column added');
        } else {
            console.log('  ✓ hero_sections.alt_text already exists, skipping');
        }

        console.log('[migrate_home_buttons] Done.');
    } catch (err) {
        console.error('[migrate_home_buttons] Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
