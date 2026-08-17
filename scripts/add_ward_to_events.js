import pool from '../configs/db.js';

async function runMigration() {
    const connection = await pool.getConnection();
    try {
        console.log('🚀 [Migration] Adding ward_id column to events table...');

        // Check if column already exists
        const [cols] = await connection.query(`
            SHOW COLUMNS FROM events LIKE 'ward_id'
        `);

        if (cols.length === 0) {
            await connection.query(`
                ALTER TABLE events 
                ADD COLUMN ward_id INT UNSIGNED DEFAULT NULL AFTER local_body_id,
                ADD CONSTRAINT fk_events_ward FOREIGN KEY (ward_id) REFERENCES local_body_wards(id) ON DELETE SET NULL
            `);
            console.log('✅ Column ward_id successfully added with foreign key constraint.');
        } else {
            console.log('ℹ️ Column ward_id already exists in events table.');
        }

        console.log('🎉 Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        connection.release();
        process.exit(0);
    }
}

runMigration();
