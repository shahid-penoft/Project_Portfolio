import pool from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Starting migration for welfare schemes...');

        await pool.query(`DROP TABLE IF EXISTS scheme_applications;`);
        console.log('Dropped scheme_applications table if existed.');

        await pool.query(`DROP TABLE IF EXISTS welfare_schemes;`);
        console.log('Dropped welfare_schemes table if existed.');

        await pool.query(`
            CREATE TABLE welfare_schemes (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                scheme_ref VARCHAR(20) UNIQUE,
                title VARCHAR(255) NOT NULL,
                scheme_status ENUM('Active', 'Expired', 'On Hold') DEFAULT 'Active',
                category VARCHAR(100),
                domain VARCHAR(100),
                deadline DATE NULL,
                status ENUM('Draft', 'Scheduled', 'Published') DEFAULT 'Draft',
                cover_image VARCHAR(500),
                description TEXT,
                features JSON,
                show_action_button BOOLEAN DEFAULT FALSE,
                action_button_label VARCHAR(100),
                action_button_url VARCHAR(500),
                eligibilities JSON,
                attachments JSON,
                show_on_website BOOLEAN DEFAULT FALSE,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log('welfare_schemes table created.');

        await pool.query(`
            CREATE TABLE scheme_applications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                reference_id VARCHAR(20) UNIQUE,
                scheme_id INT UNSIGNED NOT NULL,
                constituent_id INT UNSIGNED,
                applicant_name VARCHAR(150) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                aadhaar VARCHAR(12) NOT NULL,
                ward VARCHAR(100),
                documents JSON,
                status ENUM('pending','under_review','approved','rejected') DEFAULT 'pending',
                admin_notes TEXT,
                submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (scheme_id) REFERENCES welfare_schemes(id) ON DELETE CASCADE,
                FOREIGN KEY (constituent_id) REFERENCES constituent_users(id) ON DELETE SET NULL
            );
        `);
        console.log('scheme_applications table created.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
