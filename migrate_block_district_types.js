import pool from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Starting migration to label Block and District Panchayats...');

        const [resBlock] = await pool.query(`UPDATE local_bodies SET type = 'BLOCK_PANCHAYAT' WHERE name LIKE '%Block%'`);
        console.log(`Updated ${resBlock.affectedRows} Block Panchayats.`);

        const [resDist] = await pool.query(`UPDATE local_bodies SET type = 'DISTRICT_PANCHAYAT' WHERE name LIKE '%District%'`);
        console.log(`Updated ${resDist.affectedRows} District Panchayats.`);

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
