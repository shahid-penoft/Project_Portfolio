import db from './configs/db.js';

const runMigration = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS local_body_wards (
                id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                local_body_id   INT UNSIGNED    NOT NULL,
                ward_no         VARCHAR(50)     NOT NULL,
                place_name      VARCHAR(150)    NOT NULL,
                created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (local_body_id) REFERENCES local_bodies(id) ON DELETE CASCADE,
                UNIQUE KEY unique_ward_local_body (local_body_id, ward_no)
            );
        `);
        console.log('local_body_wards table created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
