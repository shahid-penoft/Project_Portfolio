/**
 * Migration: Create volunteers and volunteer_categories tables.
 * Run with: node migrate_volunteers.js
 */
import pool from './configs/db.js';

const run = async () => {
    const conn = await pool.getConnection();
    try {
        console.log('Running volunteers migration...');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS volunteers (
                id                INT           AUTO_INCREMENT PRIMARY KEY,
                name              VARCHAR(100)  NOT NULL,
                phone             VARCHAR(25)   NOT NULL,
                alternate_phone   VARCHAR(25)   DEFAULT NULL,
                email             VARCHAR(150)  DEFAULT NULL,
                gender            ENUM('Male','Female','Other') DEFAULT 'Male',
                blood_group       VARCHAR(5)    DEFAULT NULL,
                local_body_id     INT           DEFAULT NULL,
                panchayat         VARCHAR(150)  DEFAULT NULL,
                ward_id           INT           DEFAULT NULL,
                ward              VARCHAR(150)  DEFAULT NULL,
                house_name        VARCHAR(200)  DEFAULT NULL,
                sector            VARCHAR(100)  DEFAULT NULL,
                category          JSON          DEFAULT NULL,
                skills            JSON          DEFAULT NULL,
                availability      VARCHAR(50)   NOT NULL DEFAULT 'Weekends',
                status            ENUM('Active','On Call','Inactive') NOT NULL DEFAULT 'Active',
                notes             TEXT          DEFAULT NULL,
                profile_photo_url VARCHAR(500)  DEFAULT NULL,
                verified          TINYINT(1)    NOT NULL DEFAULT 0,
                joined_date       DATE          DEFAULT (CURDATE()),
                created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status     (status),
                INDEX idx_local_body (local_body_id),
                INDEX idx_sector     (sector(50))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table volunteers created (or already exists)');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS volunteer_categories (
                id           INT           AUTO_INCREMENT PRIMARY KEY,
                title        VARCHAR(100)  NOT NULL,
                sector       VARCHAR(100)  NOT NULL DEFAULT 'Health & Medical',
                description  TEXT          NOT NULL,
                icon_name    VARCHAR(50)   NOT NULL DEFAULT 'Users',
                color_theme  VARCHAR(20)   NOT NULL DEFAULT 'purple',
                sort_order   INT           NOT NULL DEFAULT 0,
                created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_sort (sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table volunteer_categories created (or already exists)');

        const [[countRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM volunteer_categories');
        if (countRow.cnt === 0) {
            await conn.query(`
                INSERT INTO volunteer_categories (title, sector, description, icon_name, color_theme, sort_order)
                VALUES
                    ('Care Visits',        'Elderly Care',     'Assist elderly and bedridden citizens at home with medical checkups and essential care support.',                  'Stethoscope', 'purple',  1),
                    ('Camp Support',       'Community Service','Help organize local medical camps, blood drives, health checkups, and welfare distribution events.',               'Tent',        'amber',   2),
                    ('Emergency Response', 'Disaster Relief',  'Be part of the constituency emergency response team for disaster relief and quick medical aid.',                   'Siren',       'red',     3),
                    ('Youth Activities',   'Sports & Youth',   'Lead youth empowerment initiatives, sports tournaments, career guidance, and civic awareness drives.',            'Smile',       'emerald', 4)
            `);
            console.log('Seeded 4 default volunteer categories');
        } else {
            console.log('Skipping seed - volunteer_categories already has ' + countRow.cnt + ' row(s)');
        }

        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
};

run();
