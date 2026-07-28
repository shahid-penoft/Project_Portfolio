import 'dotenv/config';
import pool from '../configs/db.js';

async function runMigration() {
    const conn = await pool.getConnection();
    try {
        console.log('🔄 Starting volunteer module migration...\n');

        // ── Step 1: Add description column to mla_dropdown_lists ──────────
        console.log('Step 1: Adding description column to mla_dropdown_lists...');
        const [cols] = await conn.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'mla_dropdown_lists'
              AND COLUMN_NAME = 'description'
        `);
        if (cols.length === 0) {
            await conn.query(`
                ALTER TABLE mla_dropdown_lists
                ADD COLUMN description TEXT NULL AFTER value
            `);
            console.log('   ✅ description column added.\n');
        } else {
            console.log('   ℹ️  description column already exists — skipped.\n');
        }

        // ── Step 2: Create volunteers table ───────────────────────────────
        console.log('Step 2: Creating volunteers table...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS volunteers (
                id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name            VARCHAR(150)  NOT NULL,
                phone           VARCHAR(25)   NOT NULL,
                alternate_phone VARCHAR(25)   NULL,
                email           VARCHAR(255)  NULL,
                local_body_id   INT UNSIGNED  NULL,
                panchayat       VARCHAR(255)  NOT NULL DEFAULT 'Kothamangalam Constituency',
                ward_id         INT UNSIGNED  NULL,
                ward            VARCHAR(255)  NULL,
                category        VARCHAR(150)  NOT NULL DEFAULT 'Care Visits',
                skills          TEXT          NULL,
                availability    VARCHAR(100)  NOT NULL DEFAULT 'Weekends',
                status          ENUM('Active','On Call','Inactive') NOT NULL DEFAULT 'Active',
                notes           TEXT          NULL,
                joined_date     DATE          NOT NULL DEFAULT (CURDATE()),
                is_active       TINYINT(1)    NOT NULL DEFAULT 1,
                created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_category (category),
                INDEX idx_status (status),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('   ✅ volunteers table created (or already exists).\n');

        // ── Step 3: Seed volunteer_activity dropdown ───────────────────────
        console.log('Step 3: Seeding volunteer_activity dropdown...');
        const [[existing]] = await conn.query(
            'SELECT id FROM mla_dropdown_lists WHERE `key` = ? LIMIT 1',
            ['volunteer_activity']
        );
        if (!existing) {
            const activities = [
                {
                    label: 'Care Visits',
                    value: 'Care Visits',
                    description: 'Assist elderly and bedridden citizens at home with medical checkups and essential care support.',
                    color: '#7c3aed',
                    icon: 'Stethoscope',
                    sort_order: 10,
                },
                {
                    label: 'Camp Support',
                    value: 'Camp Support',
                    description: 'Help organize local medical camps, blood drives, health checkups, and welfare distribution events.',
                    color: '#d97706',
                    icon: 'Tent',
                    sort_order: 20,
                },
                {
                    label: 'Emergency Response',
                    value: 'Emergency Response',
                    description: 'Be part of the constituency emergency response team for disaster relief and quick medical aid.',
                    color: '#dc2626',
                    icon: 'Siren',
                    sort_order: 30,
                },
                {
                    label: 'Youth Activities',
                    value: 'Youth Activities',
                    description: 'Lead youth empowerment initiatives, sports tournaments, career guidance, and civic awareness drives.',
                    color: '#059669',
                    icon: 'Smile',
                    sort_order: 40,
                },
            ];
            for (const act of activities) {
                await conn.query(
                    `INSERT INTO mla_dropdown_lists (\`key\`, module, sub_category, label, value, description, color, icon, sort_order, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['volunteer_activity', 'Volunteers', 'Activity Type', act.label, act.value, act.description, act.color, act.icon, act.sort_order, 'Active']
                );
            }
            console.log('   ✅ 4 volunteer activities seeded.\n');
        } else {
            console.log('   ℹ️  volunteer_activity dropdown already exists — skipped.\n');
        }

        // ── Step 4: Seed site_settings ─────────────────────────────────────
        console.log('Step 4: Seeding volunteer_section_visible site setting...');
        await conn.query(`
            INSERT INTO site_settings (setting_key, setting_value, description)
            VALUES ('volunteer_section_visible', 'true', 'Controls visibility of the Volunteer Force section on the public Engage page')
            ON DUPLICATE KEY UPDATE setting_value = setting_value
        `);
        console.log('   ✅ volunteer_section_visible setting seeded.\n');

        console.log('🎉 Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

runMigration();
