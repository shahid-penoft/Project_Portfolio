import db from './configs/db.js';

const migrate = async () => {
    try {
        const [cols] = await db.query(`SHOW COLUMNS FROM geo_locations LIKE 'has_wheelchair'`);
        if (cols.length > 0) {
            console.log('✅ Column has_wheelchair already exists. Skipping.');
        } else {
            await db.query(`ALTER TABLE geo_locations ADD COLUMN has_wheelchair TINYINT(1) NOT NULL DEFAULT 0 AFTER has_parking`);
            console.log('✅ Column has_wheelchair added successfully.');
        }
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        process.exit(0);
    }
};

migrate();
