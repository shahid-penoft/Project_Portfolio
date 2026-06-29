import db from './configs/db.js';

const migrate = async () => {
    try {
        console.log('Dropping constituent_users...');
        await db.query('DROP TABLE IF EXISTS constituent_users');

        console.log('Recreating constituent_users...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS constituent_users (
                id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                full_name           VARCHAR(100) NOT NULL,
                phone               VARCHAR(20)  DEFAULT NULL,
                email               VARCHAR(150) NOT NULL UNIQUE,
                password            VARCHAR(255) NOT NULL,
                gender              ENUM('male', 'female', 'other') DEFAULT NULL,
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

        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrate();
