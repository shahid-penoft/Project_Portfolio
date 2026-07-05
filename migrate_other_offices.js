import pool from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Starting migration for other offices...');

        // 1. Alter governing_representatives table
        console.log('Altering governing_representatives table...');
        
        // Use a safe wrapper to ignore errors if columns already exist
        const alterQueries = [
            'ALTER TABLE governing_representatives ADD COLUMN department VARCHAR(255)',
            'ALTER TABLE governing_representatives ADD COLUMN head_name VARCHAR(255)',
            'ALTER TABLE governing_representatives ADD COLUMN hours VARCHAR(255)',
            'ALTER TABLE governing_representatives ADD COLUMN avatar_color VARCHAR(50)',
            'ALTER TABLE governing_representatives ADD COLUMN officer_phone VARCHAR(20)'
        ];

        for (const q of alterQueries) {
            try {
                await pool.query(q);
                console.log(`Executed: ${q}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Column already exists, skipping: ${q}`);
                } else {
                    throw err;
                }
            }
        }

        // 2. Create governing_body_staffs table
        console.log('Creating governing_body_staffs table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS governing_body_staffs (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                governing_body_id INT UNSIGNED NOT NULL,
                name VARCHAR(255) NOT NULL,
                designation VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                is_key BOOLEAN DEFAULT FALSE,
                color VARCHAR(50),
                photo_url VARCHAR(255),
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (governing_body_id) REFERENCES governing_representatives(id) ON DELETE CASCADE
            );
        `);
        console.log('governing_body_staffs table created or already exists.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
