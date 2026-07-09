import pool from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Altering governing_representatives table...');
        
        await pool.query('ALTER TABLE governing_representatives MODIFY COLUMN role_id INT UNSIGNED NULL');
        console.log('✅ Made role_id nullable');
        
        await pool.query('ALTER TABLE governing_representatives MODIFY COLUMN local_body_id INT UNSIGNED NULL');
        console.log('✅ Made local_body_id nullable');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
