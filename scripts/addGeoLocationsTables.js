import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

async function migrate() {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database.');

    try {
        // 1. Create geo_locations table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS geo_locations (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                type             ENUM('Simple Landmark','Detailed Location') NOT NULL DEFAULT 'Simple Landmark',
                name             VARCHAR(255) NOT NULL,
                category         VARCHAR(100),
                sub_category     VARCHAR(100),
                established_year VARCHAR(10),
                phone            VARCHAR(30),
                any_history      ENUM('Yes','No') DEFAULT 'No',
                history_details  TEXT,
                ward             VARCHAR(50),
                landmark         VARCHAR(255),
                full_address     TEXT,
                coordinates      VARCHAR(100),
                digipin          VARCHAR(100),
                contact_person   VARCHAR(100),
                contact_role     VARCHAR(100),
                contact_number   VARCHAR(30),
                alt_number       VARCHAR(30),
                operating_hours  VARCHAR(100),
                website          VARCHAR(255),
                facilities       TEXT,
                description      TEXT,
                is_operational   TINYINT(1) DEFAULT 1,
                is_public_access TINYINT(1) DEFAULT 1,
                has_parking      TINYINT(1) DEFAULT 0,
                status           ENUM('published','draft') DEFAULT 'published',
                created_by       INT UNSIGNED,
                updated_by       INT UNSIGNED,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
                FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
            )
        `);
        console.log('Table "geo_locations" verified/created.');

        // 2. Create geo_location_images table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS geo_location_images (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                location_id INT NOT NULL,
                url         VARCHAR(500) NOT NULL,
                filename    VARCHAR(255),
                size_bytes  BIGINT,
                display_order INT DEFAULT 0,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (location_id) REFERENCES geo_locations(id) ON DELETE CASCADE
            )
        `);
        console.log('Table "geo_location_images" verified/created.');

        // 3. Create geo_location_attachments table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS geo_location_attachments (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                location_id INT NOT NULL,
                name        VARCHAR(255) NOT NULL,
                url         VARCHAR(500) NOT NULL,
                size_bytes  BIGINT,
                created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (location_id) REFERENCES geo_locations(id) ON DELETE CASCADE
            )
        `);
        console.log('Table "geo_location_attachments" verified/created.');

        // 4. Create geo_location_bookmarks table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS geo_location_bookmarks (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                location_id  INT NOT NULL,
                constituent_id INT UNSIGNED NOT NULL,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_loc_constituent (location_id, constituent_id),
                FOREIGN KEY (location_id)   REFERENCES geo_locations(id) ON DELETE CASCADE,
                FOREIGN KEY (constituent_id) REFERENCES constituent_users(id) ON DELETE CASCADE
            )
        `);
        console.log('Table "geo_location_bookmarks" verified/created.');

        // 5. Add 'geo-location' to any existing role that has 'enquiries' permission
        const [roles] = await connection.query(`SELECT id, permissions FROM admin_roles`);
        let updatedCount = 0;
        for (let role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { perms = []; }
            }
            if (Array.isArray(perms) && perms.includes('enquiries') && !perms.includes('geo-location')) {
                perms.push('geo-location');
                await connection.query(`UPDATE admin_roles SET permissions = ? WHERE id = ?`, [JSON.stringify(perms), role.id]);
                updatedCount++;
            }
        }
        console.log(`Updated ${updatedCount} roles with 'geo-location' permission.`);

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

migrate();
