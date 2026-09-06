import pool from '../configs/db.js';

/**
 * Migration 018: Add hide_from_public and communication details to update tables
 */
export async function runMigration() {
    const connection = await pool.getConnection();
    try {
        console.log('🚀 Starting Migration 018: Add hide_from_public and comm tracking columns...');
        await connection.beginTransaction();

        const updateTables = [
            'complaint_updates',
            'cm_fund_updates',
            'issue_updates',
            'idea_updates',
            'suggestion_updates'
        ];

        const columnsToAdd = [
            { name: 'hide_from_public', spec: 'TINYINT(1) NOT NULL DEFAULT 0' },
            { name: 'comm_channel', spec: 'VARCHAR(50) NULL DEFAULT NULL' },
            { name: 'comm_sent_at', spec: 'DATETIME NULL DEFAULT NULL' },
            { name: 'email_sent', spec: 'TINYINT(1) DEFAULT 0' },
            { name: 'email_body', spec: 'TEXT DEFAULT NULL' },
            { name: 'sms_sent', spec: 'TINYINT(1) DEFAULT 0' },
            { name: 'sms_body', spec: 'TEXT DEFAULT NULL' }
        ];

        for (const tbl of updateTables) {
            console.log(`\n--- Checking table: ${tbl} ---`);

            for (const col of columnsToAdd) {
                const [cols] = await connection.query(`
                    SELECT COLUMN_NAME 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = ? 
                      AND COLUMN_NAME = ?
                `, [tbl, col.name]);

                if (cols.length === 0) {
                    console.log(`Adding ${col.name} column to ${tbl}...`);
                    await connection.query(`
                        ALTER TABLE ${tbl}
                        ADD COLUMN ${col.name} ${col.spec}
                    `);
                    console.log(`✅ Column ${col.name} added to ${tbl}.`);
                } else {
                    console.log(`ℹ️ Column ${col.name} already exists on ${tbl}.`);
                }
            }

            // Check and add index for hide_from_public
            const [indices] = await connection.query(`
                SHOW INDEX FROM ${tbl} WHERE Key_name = ?
            `, [`idx_${tbl}_hide_from_public`]);

            if (indices.length === 0) {
                console.log(`Adding index idx_${tbl}_hide_from_public...`);
                await connection.query(`
                    CREATE INDEX idx_${tbl}_hide_from_public ON ${tbl} (hide_from_public)
                `);
                console.log(`✅ Index added.`);
            } else {
                console.log(`ℹ️ Index idx_${tbl}_hide_from_public already exists.`);
            }
        }

        // Check communications_logs for update_id column
        console.log(`\n--- Checking communications_logs table ---`);
        const [commCols] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'communications_logs' 
              AND COLUMN_NAME = 'update_id'
        `);

        if (commCols.length === 0) {
            console.log('Adding update_id column to communications_logs...');
            await connection.query(`
                ALTER TABLE communications_logs
                ADD COLUMN update_id INT UNSIGNED NULL DEFAULT NULL
            `);
            console.log('✅ Column update_id added to communications_logs.');
        } else {
            console.log('ℹ️ Column update_id already exists on communications_logs.');
        }

        const [commIndices] = await connection.query(`
            SHOW INDEX FROM communications_logs WHERE Key_name = 'idx_comm_logs_update_id'
        `);

        if (commIndices.length === 0) {
            console.log('Adding index idx_comm_logs_update_id...');
            await connection.query(`
                CREATE INDEX idx_comm_logs_update_id ON communications_logs (update_id)
            `);
            console.log('✅ Index added.');
        } else {
            console.log('ℹ️ Index idx_comm_logs_update_id already exists.');
        }

        // Backfill historical SMS records
        console.log('\n--- Backfilling historical SMS records ---');
        for (const tbl of updateTables) {
            await connection.query(`
                UPDATE ${tbl}
                SET comm_channel = 'sms', comm_sent_at = created_at
                WHERE sms_sent = 1 AND comm_channel IS NULL
            `);
        }
        console.log('✅ Backfill complete.');

        await connection.commit();
        console.log('\n🎉 Migration 018 executed successfully!');
    } catch (err) {
        await connection.rollback();
        console.error('❌ Migration 018 failed:', err);
        throw err;
    } finally {
        connection.release();
    }
}

// Direct execution
if (process.argv[1] && process.argv[1].endsWith('018_add_hide_from_public_and_comm_details_to_updates.js')) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
