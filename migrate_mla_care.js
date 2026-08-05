import pool from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('🚀 Running MLA Care Applications Migration...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS mla_care_applications (
                id               INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                ref_no           VARCHAR(30)     NOT NULL,
                patient_name     VARCHAR(150)    NOT NULL,
                phone            VARCHAR(25)     NOT NULL,
                care_category    VARCHAR(80)     NOT NULL,
                local_body_id    INT UNSIGNED    NOT NULL,
                ward_id          INT UNSIGNED    DEFAULT NULL,
                house_name       VARCHAR(200)    DEFAULT NULL,
                medical_details  TEXT            DEFAULT NULL,
                document_url     VARCHAR(500)    DEFAULT NULL,
                document_name    VARCHAR(255)    DEFAULT NULL,
                consent_given    TINYINT(1)      NOT NULL DEFAULT 0,
                status           ENUM('Pending','Verified','Approved','Rejected') NOT NULL DEFAULT 'Pending',
                created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_ref_no (ref_no),
                INDEX idx_status (status),
                INDEX idx_local_body (local_body_id),
                INDEX idx_category (care_category)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Checked `mla_care_applications` table');

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
