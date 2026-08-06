import db from './configs/db.js';

async function migrate() {
    try {
        console.log('Running ALTER TABLE local_bodies...');
        const query = `
            ALTER TABLE local_bodies
            ADD COLUMN type VARCHAR(255) NULL,
            ADD COLUMN headquarters VARCHAR(255) NULL,
            ADD COLUMN office_address VARCHAR(500) NULL,
            ADD COLUMN office_phone VARCHAR(50) NULL,
            ADD COLUMN office_email VARCHAR(255) NULL,
            ADD COLUMN office_working_hours JSON NULL,
            ADD COLUMN office_google_maps_url VARCHAR(500) NULL
        `;
        await db.query(query);
        console.log('✅ Migration successful');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️ Columns already exist. Skipping.');
            process.exit(0);
        } else {
            console.error('❌ Migration failed:', err);
            process.exit(1);
        }
    }
}

migrate();
