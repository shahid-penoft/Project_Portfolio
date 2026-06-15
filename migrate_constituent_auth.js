import db from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Running Constituent Auth Migration...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS constituent_users (
                id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                full_name           VARCHAR(100) NOT NULL,
                phone               VARCHAR(20)  NOT NULL UNIQUE,
                email               VARCHAR(150) DEFAULT NULL,
                password            VARCHAR(255) NOT NULL,
                verification_method ENUM('aadhar','voterId') NOT NULL,
                verification_id     VARCHAR(20)  NOT NULL,
                panchayat_id        INT UNSIGNED NOT NULL,
                ward_id             INT UNSIGNED NOT NULL,
                house_name          VARCHAR(150) NOT NULL,
                house_number        VARCHAR(50)  NOT NULL,
                constituency        VARCHAR(100) NOT NULL DEFAULT 'Kothamangalam',
                is_active           BOOLEAN      NOT NULL DEFAULT 1,
                last_login          DATETIME     DEFAULT NULL,
                created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (panchayat_id) REFERENCES local_bodies(id),
                FOREIGN KEY (ward_id)      REFERENCES local_body_wards(id)
            )
        `);
        console.log('Created constituent_users table');

        await db.query(`
            CREATE TABLE IF NOT EXISTS constituent_password_resets (
                id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                email      VARCHAR(150) NOT NULL,
                token      VARCHAR(255) NOT NULL,
                expires_at DATETIME     NOT NULL,
                used       BOOLEAN      NOT NULL DEFAULT 0,
                created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_token (token)
            )
        `);
        console.log('Created constituent_password_resets table');

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
