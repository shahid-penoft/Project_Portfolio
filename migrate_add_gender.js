import db from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Adding gender column to constituent_users...');
        
        await db.query(`
            ALTER TABLE constituent_users
            ADD COLUMN gender VARCHAR(20) DEFAULT NULL AFTER password
        `);
        console.log('Successfully added gender column.');
        
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Gender column already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        process.exit();
    }
};

runMigration();
