import pool from '../configs/db.js';

async function migrate() {
    const connection = await pool.getConnection();
    try {
        console.log('--- Starting Enquiry Status Draft Migration ---');
        await connection.beginTransaction();

        // 1. Alter contact_enquiries status column default to 'Draft'
        await connection.query(
            "ALTER TABLE contact_enquiries MODIFY COLUMN status VARCHAR(100) NOT NULL DEFAULT 'Draft'"
        );
        console.log('✅ Altered contact_enquiries.status DEFAULT to "Draft"');

        // 2. Update existing records with 'New' or 'new' to 'Draft'
        const [updateResult] = await connection.query(
            "UPDATE contact_enquiries SET status = 'Draft' WHERE status IN ('New', 'new')"
        );
        console.log(`✅ Updated ${updateResult.affectedRows} existing enquiry rows from 'New' to 'Draft'`);

        // 3. Clean up 'New' and any 'test' entries from mla_dropdown_lists for 'enquiry_status'
        await connection.query(
            "DELETE FROM mla_dropdown_lists WHERE `key` = 'enquiry_status' AND (value IN ('New', 'new', 'test') OR label IN ('New', 'new', 'test'))"
        );
        console.log('✅ Removed "New" and test items from enquiry_status dropdown');

        // 4. Ensure non-draft options are not marked default
        await connection.query(
            "UPDATE mla_dropdown_lists SET is_default = 0 WHERE `key` = 'enquiry_status'"
        );

        // 5. Check if 'Draft' exists in enquiry_status
        const [draftRows] = await connection.query(
            "SELECT id FROM mla_dropdown_lists WHERE `key` = 'enquiry_status' AND (value = 'Draft' OR label = 'Draft')"
        );

        if (draftRows.length === 0) {
            await connection.query(
                `INSERT INTO mla_dropdown_lists
                 (\`key\`, module, sub_category, label, value, parent_id, color, icon, sort_order, is_default, is_system, status)
                 VALUES ('enquiry_status', 'Enquiries', 'Status Labels', 'Draft', 'Draft', 0, 'slate', NULL, 10, 1, 1, 'Active')`
            );
            console.log('✅ Inserted "Draft" as default system-locked option in enquiry_status');
        } else {
            await connection.query(
                `UPDATE mla_dropdown_lists
                 SET is_default = 1, is_system = 1, sort_order = 10, color = 'slate', status = 'Active', label = 'Draft', value = 'Draft'
                 WHERE id = ?`,
                [draftRows[0].id]
            );
            console.log('✅ Updated "Draft" as default system-locked option in enquiry_status');
        }

        await connection.commit();
        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        await connection.rollback();
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

migrate();
