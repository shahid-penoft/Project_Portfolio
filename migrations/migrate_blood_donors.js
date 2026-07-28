import pool from '../configs/db.js';

const runMigration = async () => {
    try {
        console.log('🚀 Running Blood Donor Directory Migration...');

        // 1. Create blood_donors table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS blood_donors (
                id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name                VARCHAR(255) NOT NULL,
                blood_group         ENUM('O+','O-','A+','A-','B+','B-','AB+','AB-') NOT NULL,
                phone               VARCHAR(20)  NOT NULL,
                panchayat           VARCHAR(255) NOT NULL,
                local_body_id       INT UNSIGNED DEFAULT NULL,
                ward_id             INT UNSIGNED DEFAULT NULL,
                last_donated        VARCHAR(100) NOT NULL DEFAULT 'Recently Registered',
                is_verified         TINYINT(1)   NOT NULL DEFAULT 1,
                is_active           TINYINT(1)   NOT NULL DEFAULT 1,
                created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_blood_group (blood_group),
                INDEX idx_is_active (is_active),
                INDEX idx_local_body (local_body_id),
                INDEX idx_ward (ward_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Checked `blood_donors` table');

        // Add local_body_id, ward_id, alternate_phone, email, status, notes, profile_photo_url columns if table already existed without them
        try {
            await pool.query(`ALTER TABLE blood_donors ADD COLUMN local_body_id INT UNSIGNED DEFAULT NULL AFTER panchayat`);
        } catch { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE blood_donors ADD COLUMN ward_id INT UNSIGNED DEFAULT NULL AFTER local_body_id`);
        } catch { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE blood_donors ADD COLUMN alternate_phone VARCHAR(20) DEFAULT NULL AFTER phone`);
        } catch { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE blood_donors ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER alternate_phone`);
        } catch { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE blood_donors ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Accepted' AFTER is_active`);
        } catch { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE blood_donors ADD COLUMN notes TEXT DEFAULT NULL AFTER status`);
        } catch { /* column already exists */ }

        try {
            await pool.query(`ALTER TABLE blood_donors ADD COLUMN profile_photo_url VARCHAR(500) DEFAULT NULL AFTER notes`);
        } catch { /* column already exists */ }

        // 2. Create urgent_blood_needs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS urgent_blood_needs (
                id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                title               VARCHAR(255) NOT NULL,
                blood_group         VARCHAR(10)  NOT NULL,
                units_needed        INT NOT NULL DEFAULT 1,
                hospital_name       VARCHAR(255) NOT NULL,
                ward_details        VARCHAR(255) DEFAULT NULL,
                contact_phone       VARCHAR(20)  NOT NULL,
                status              ENUM('active', 'fulfilled') NOT NULL DEFAULT 'active',
                created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Checked `urgent_blood_needs` table');

        // 4. Seed initial urgent blood need if empty
        const [[{ count: urgentCount }]] = await pool.query('SELECT COUNT(*) AS count FROM urgent_blood_needs');
        if (urgentCount === 0) {
            await pool.query(`
                INSERT INTO urgent_blood_needs (title, blood_group, units_needed, hospital_name, ward_details, contact_phone, status)
                VALUES ('Urgent Blood Need: O+ve Needed (2 Units)', 'O+', 2, 'Kothamangalam Taluk Hospital', 'Emergency ICU Ward', '0485-2862234', 'active')
            `);
            console.log('✅ Seeded initial urgent blood need alert');
        }

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

runMigration();
