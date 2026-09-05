import pool from '../configs/db.js';

async function run() {
    try {
        const [cols] = await pool.query("SHOW COLUMNS FROM contact_enquiries LIKE 'is_deleted'");
        if (!cols.length) {
            console.log('Adding is_deleted and deleted_at to contact_enquiries...');
            await pool.query(`
                ALTER TABLE contact_enquiries
                ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL
            `);
            await pool.query(`
                CREATE INDEX idx_enquiries_is_deleted ON contact_enquiries (is_deleted, created_at)
            `);
            console.log('✓ Successfully added is_deleted and deleted_at columns with index.');
        } else {
            console.log('✓ is_deleted column already exists.');
        }
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
