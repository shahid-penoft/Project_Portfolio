import db from './configs/db.js';

async function migrate() {
    const conn = await db.getConnection();
    try {
        console.log('[migrate_about_journey_recognitions] Running...');

        // 1. Check and add title, year to recognitions table
        const [recCols] = await conn.query('DESCRIBE recognitions');
        const recColNames = recCols.map(c => c.Field);

        if (!recColNames.includes('title')) {
            await conn.query('ALTER TABLE recognitions ADD COLUMN title VARCHAR(255) NULL AFTER id');
            console.log('  ✓ Added `title` column to recognitions');
        } else {
            console.log('  ✓ `title` column already exists in recognitions');
        }

        if (!recColNames.includes('year')) {
            await conn.query('ALTER TABLE recognitions ADD COLUMN year VARCHAR(50) NULL AFTER title');
            console.log('  ✓ Added `year` column to recognitions');
        } else {
            console.log('  ✓ `year` column already exists in recognitions');
        }

        // 2. Check and ensure description in timelines table
        const [timeCols] = await conn.query('DESCRIBE timelines');
        const timeColNames = timeCols.map(c => c.Field);

        if (!timeColNames.includes('description')) {
            await conn.query('ALTER TABLE timelines ADD COLUMN description TEXT NULL AFTER title');
            console.log('  ✓ Added `description` column to timelines');
        } else {
            console.log('  ✓ `description` column already exists in timelines');
        }

        console.log('[migrate_about_journey_recognitions] Migration completed successfully.');
    } catch (err) {
        console.error('[migrate_about_journey_recognitions] Error:', err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

migrate();
