import pool from '../configs/db.js';

/**
 * Migration 015: Enquiries Module Production Migration
 * 
 * 1. Ensures `is_system` column exists on `mla_dropdown_lists`
 * 2. Adds `is_deleted` and `deleted_at` trash support columns & index to `contact_enquiries`
 * 3. Alters `contact_enquiries.status` column to VARCHAR(100) DEFAULT 'Draft'
 * 4. Alters `contact_enquiries.category` column to VARCHAR(100) DEFAULT 'General'
 * 5. Adds index `idx_enquiries_status_created` on `contact_enquiries`
 * 6. Creates `enquiry_notes` table if not exists (for internal notes feature)
 * 7. Migrates legacy 'New' / 'new' statuses to 'Draft'
 * 8. Cleans up obsolete 'New' / test entries in `mla_dropdown_lists`
 * 9. Seeds/updates 'Draft' as system-locked default in `enquiry_status`
 * 10. Seeds standard `enquiry_status` and `enquiry_category` options if missing
 */

export async function runMigration() {
    const connection = await pool.getConnection();
    try {
        console.log('🚀 Starting Migration 015: Enquiries Trash & Draft Status...');
        await connection.beginTransaction();

        // ── 1. Check is_system on mla_dropdown_lists ──────────────
        const [isSystemCols] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'mla_dropdown_lists' 
              AND COLUMN_NAME = 'is_system'
        `);
        if (isSystemCols.length === 0) {
            console.log('Adding is_system column to mla_dropdown_lists...');
            await connection.query('ALTER TABLE mla_dropdown_lists ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0');
            console.log('✓ Added is_system column.');
        } else {
            console.log('✓ mla_dropdown_lists.is_system already exists.');
        }

        // ── 2. Add is_deleted & deleted_at to contact_enquiries ────
        const [isDeletedCols] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'contact_enquiries' 
              AND COLUMN_NAME = 'is_deleted'
        `);
        if (isDeletedCols.length === 0) {
            console.log('Adding is_deleted and deleted_at to contact_enquiries...');
            await connection.query(`
                ALTER TABLE contact_enquiries
                ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL
            `);
            console.log('✓ Added trash columns to contact_enquiries.');
        } else {
            console.log('✓ contact_enquiries.is_deleted already exists.');
        }

        // Check index idx_enquiries_is_deleted
        const [isDeletedIndexes] = await connection.query(`
            SHOW INDEX FROM contact_enquiries WHERE Key_name = 'idx_enquiries_is_deleted'
        `);
        if (isDeletedIndexes.length === 0) {
            await connection.query('CREATE INDEX idx_enquiries_is_deleted ON contact_enquiries (is_deleted, created_at)');
            console.log('✓ Created index idx_enquiries_is_deleted.');
        }

        // ── 3. Alter status & category columns on contact_enquiries ──
        console.log('Altering contact_enquiries.status column to VARCHAR(100) DEFAULT "Draft"...');
        await connection.query("ALTER TABLE contact_enquiries MODIFY COLUMN status VARCHAR(100) NOT NULL DEFAULT 'Draft'");
        console.log('✓ Altered status column.');

        console.log('Altering contact_enquiries.category column to VARCHAR(100) DEFAULT "General"...');
        await connection.query("ALTER TABLE contact_enquiries MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'General'");
        console.log('✓ Altered category column.');

        // Check index idx_enquiries_status_created
        const [statusIndexes] = await connection.query(`
            SHOW INDEX FROM contact_enquiries WHERE Key_name = 'idx_enquiries_status_created'
        `);
        if (statusIndexes.length === 0) {
            await connection.query('CREATE INDEX idx_enquiries_status_created ON contact_enquiries (status, created_at)');
            console.log('✓ Created index idx_enquiries_status_created.');
        }

        // ── 4. Create enquiry_notes table if not exists ─────────────
        console.log('Ensuring enquiry_notes table exists...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`enquiry_notes\` (
                \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                \`enquiry_id\` INT UNSIGNED NOT NULL,
                \`note\` TEXT NOT NULL,
                \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`idx_enquiry\` (\`enquiry_id\`),
                CONSTRAINT \`fk_note_enquiry\` FOREIGN KEY (\`enquiry_id\`) REFERENCES \`contact_enquiries\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
        console.log('✓ enquiry_notes table verified.');

        // ── 5. Standardize existing data ────────────────────────────
        const [updStatus] = await connection.query("UPDATE contact_enquiries SET status = 'Draft' WHERE status IN ('New', 'new')");
        console.log(`✓ Updated ${updStatus.affectedRows} rows from 'New' to 'Draft'.`);

        await connection.query("UPDATE contact_enquiries SET status = 'Read' WHERE status = 'read'");
        await connection.query("UPDATE contact_enquiries SET status = 'In Progress' WHERE status IN ('in progress', 'in_progress')");
        await connection.query("UPDATE contact_enquiries SET status = 'Resolved' WHERE status = 'resolved'");
        await connection.query("UPDATE contact_enquiries SET status = 'Closed' WHERE status = 'closed'");

        await connection.query("UPDATE contact_enquiries SET category = 'General' WHERE LOWER(category) = 'general'");
        await connection.query("UPDATE contact_enquiries SET category = 'Membership' WHERE LOWER(category) = 'membership'");
        await connection.query("UPDATE contact_enquiries SET category = 'Local Issues' WHERE LOWER(category) = 'local issues'");
        await connection.query("UPDATE contact_enquiries SET category = 'Submit Ideas' WHERE LOWER(category) = 'submit ideas'");
        await connection.query("UPDATE contact_enquiries SET category = 'Submit Opinions' WHERE LOWER(category) = 'submit opinions'");

        // ── 6. Clean up obsolete dropdown entries ───────────────────
        await connection.query(`
            DELETE FROM mla_dropdown_lists 
            WHERE \`key\` = 'enquiry_status' 
              AND (value IN ('New', 'new', 'test') OR label IN ('New', 'new', 'test'))
        `);
        console.log('✓ Cleaned up obsolete "New"/test dropdown entries.');

        // ── 7. Seed / Update enquiry_status dropdown options ─────────
        const statusOptions = [
            { label: 'Draft', value: 'Draft', color: 'slate', is_default: 1, is_system: 1, sort_order: 10 },
            { label: 'Read', value: 'Read', color: 'blue', is_default: 0, is_system: 0, sort_order: 20 },
            { label: 'In Progress', value: 'In Progress', color: 'amber', is_default: 0, is_system: 0, sort_order: 30 },
            { label: 'Resolved', value: 'Resolved', color: 'green', is_default: 0, is_system: 0, sort_order: 40 },
            { label: 'Closed', value: 'Closed', color: 'gray', is_default: 0, is_system: 0, sort_order: 50 },
        ];

        for (const s of statusOptions) {
            const [existing] = await connection.query(
                "SELECT id FROM mla_dropdown_lists WHERE `key` = 'enquiry_status' AND (value = ? OR label = ?) LIMIT 1",
                [s.value, s.label]
            );
            if (existing.length === 0) {
                await connection.query(`
                    INSERT INTO mla_dropdown_lists
                    (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, is_default, is_system, status)
                    VALUES ('enquiry_status', 'Enquiries', 'Status Labels', ?, ?, 0, ?, NULL, ?, ?, ?, 'Active')
                `, [s.label, s.value, s.color, s.sort_order, s.is_default, s.is_system]);
                console.log(`✓ Inserted enquiry_status: ${s.label}`);
            } else {
                await connection.query(`
                    UPDATE mla_dropdown_lists
                    SET label = ?, value = ?, color = ?, sort_order = ?, is_default = ?, is_system = ?, status = 'Active'
                    WHERE id = ?
                `, [s.label, s.value, s.color, s.sort_order, s.is_default, s.is_system, existing[0].id]);
                console.log(`✓ Updated enquiry_status: ${s.label}`);
            }
        }

        // ── 8. Seed enquiry_category dropdown options ───────────────
        const categoryOptions = [
            { label: 'General', value: 'General', sort_order: 10, is_default: 1 },
            { label: 'Membership', value: 'Membership', sort_order: 20, is_default: 0 },
            { label: 'Local Issues', value: 'Local Issues', sort_order: 30, is_default: 0 },
            { label: 'Submit Ideas', value: 'Submit Ideas', sort_order: 40, is_default: 0 },
            { label: 'Submit Opinions', value: 'Submit Opinions', sort_order: 50, is_default: 0 },
            { label: 'Other', value: 'Other', sort_order: 60, is_default: 0 },
        ];

        for (const c of categoryOptions) {
            const [existing] = await connection.query(
                "SELECT id FROM mla_dropdown_lists WHERE `key` = 'enquiry_category' AND (value = ? OR label = ?) LIMIT 1",
                [c.value, c.label]
            );
            if (existing.length === 0) {
                await connection.query(`
                    INSERT INTO mla_dropdown_lists
                    (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, is_default, is_system, status)
                    VALUES ('enquiry_category', 'Enquiries', 'Categories', ?, ?, 0, NULL, NULL, ?, ?, 0, 'Active')
                `, [c.label, c.value, c.sort_order, c.is_default]);
                console.log(`✓ Inserted enquiry_category: ${c.label}`);
            }
        }

        await connection.commit();
        console.log('🎉 Migration 015 completed successfully!');
    } catch (err) {
        await connection.rollback();
        console.error('❌ Migration 015 failed:', err);
        throw err;
    } finally {
        connection.release();
    }
}

// Execute if run directly
if (process.argv[1]?.endsWith('015_enquiries_trash_and_draft_status.js')) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
