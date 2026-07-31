import pool from './configs/db.js';

async function cleanupDuplicateDropdowns() {
    console.log('--- Cleaning up duplicate options & setting parent_id = 0 uniqueness ---');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query("SET FOREIGN_KEY_CHECKS=0");

        // 1. Drop existing foreign keys on parent_id
        const [fks] = await connection.query(`
            SELECT CONSTRAINT_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'mla_dropdown_lists'
              AND COLUMN_NAME = 'parent_id'
              AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

        for (const fk of fks) {
            console.log(`Dropping FK constraint ${fk.CONSTRAINT_NAME}...`);
            await connection.query(`ALTER TABLE mla_dropdown_lists DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }

        // 2. Drop existing indexes if any
        try { await connection.query("ALTER TABLE mla_dropdown_lists DROP INDEX idx_key_value_parent"); } catch (_) {}
        try { await connection.query("ALTER TABLE mla_dropdown_lists DROP INDEX idx_unique_key_value_parent"); } catch (_) {}

        // 3. Convert all NULL parent_id values to 0
        console.log('Converting NULL parent_id values to 0...');
        await connection.query("UPDATE mla_dropdown_lists SET parent_id = 0 WHERE parent_id IS NULL");

        // 4. Update parent_id column definition to INT UNSIGNED DEFAULT 0
        console.log('Updating parent_id column definition...');
        await connection.query("ALTER TABLE mla_dropdown_lists MODIFY parent_id INT UNSIGNED DEFAULT 0");

        // 5. Remove existing duplicate rows (keeping lowest ID per key, LOWER(value), parent_id)
        const [duplicates] = await connection.query(`
            SELECT \`key\`, LOWER(value) as val, parent_id as pid, COUNT(*) as cnt, MIN(id) as min_id
            FROM mla_dropdown_lists
            GROUP BY \`key\`, LOWER(value), parent_id
            HAVING cnt > 1
        `);

        console.log(`Found ${duplicates.length} duplicate groups in database.`);

        let totalRemoved = 0;
        for (const dup of duplicates) {
            const [res] = await connection.query(
                `DELETE FROM mla_dropdown_lists WHERE \`key\` = ? AND LOWER(value) = ? AND parent_id = ? AND id != ?`,
                [dup.key, dup.val, dup.pid, dup.min_id]
            );
            totalRemoved += res.affectedRows;
            console.log(`- Cleared ${res.affectedRows} duplicates for key "${dup.key}", value "${dup.val}"`);
        }
        console.log(`Total duplicate rows removed: ${totalRemoved}`);

        // 6. Add UNIQUE index idx_key_value_parent (key, value(50), parent_id)
        console.log('Enforcing UNIQUE KEY idx_key_value_parent (key, value(50), parent_id)...');
        await connection.query(`
            ALTER TABLE mla_dropdown_lists
            ADD UNIQUE KEY idx_key_value_parent (\`key\`, value(50), parent_id)
        `);

        await connection.query("SET FOREIGN_KEY_CHECKS=1");
        await connection.commit();
        console.log('✅ Migration & cleanup completed successfully!');
    } catch (err) {
        await connection.rollback();
        console.error('❌ Migration failed:', err.message);
    } finally {
        connection.release();
        process.exit(0);
    }
}

cleanupDuplicateDropdowns();
