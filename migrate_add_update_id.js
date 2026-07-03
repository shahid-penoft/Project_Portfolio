import pool from './configs/db.js';

async function runMigration() {
    const tables = [
        'complaint_media', 'complaint_attachments',
        'issue_media', 'issue_attachments',
        'idea_media', 'idea_attachments',
        'suggestion_media', 'suggestion_attachments'
    ];

    try {
        console.log('Starting migration to add update_id...');
        for (const table of tables) {
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN update_id INT UNSIGNED DEFAULT NULL`);
                console.log(`Added update_id to ${table}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column update_id already exists in ${table}`);
                } else {
                    console.error(`Error adding update_id to ${table}:`, err.message);
                }
            }
        }
        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
