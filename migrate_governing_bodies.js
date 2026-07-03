import pool from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Starting migration for governing_representatives...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS governing_representatives (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                governing_body_type ENUM('GRAM_PANCHAYAT', 'MUNICIPALITY', 'BLOCK_PANCHAYAT', 'DISTRICT_PANCHAYAT', 'OTHER') NOT NULL,
                local_body_id INT UNSIGNED NOT NULL,
                ward_id INT UNSIGNED NULL,
                name VARCHAR(255) NOT NULL,
                role_id INT UNSIGNED NOT NULL,
                gender VARCHAR(20),
                age INT,
                phone VARCHAR(20) NOT NULL,
                alternative_phone VARCHAR(20),
                email VARCHAR(255),
                house_name VARCHAR(255),
                home_address TEXT,
                location JSON,
                bio TEXT,
                office_name VARCHAR(255),
                office_phone VARCHAR(20),
                office_email VARCHAR(255),
                office_address TEXT,
                office_location JSON,
                additional_roles JSON,
                achievements JSON,
                notes JSON,
                bookmarked BOOLEAN DEFAULT FALSE,
                photo_url VARCHAR(255),
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE RESTRICT,
                FOREIGN KEY (ward_id) REFERENCES local_body_wards(id) ON DELETE SET NULL,
                FOREIGN KEY (role_id) REFERENCES mla_dropdown_lists(id) ON DELETE RESTRICT
            );
        `);
        console.log('governing_representatives table created or exists.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
