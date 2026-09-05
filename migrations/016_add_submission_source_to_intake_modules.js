import pool from '../configs/db.js';

/**
 * Migration 016: Add submission_source to Core Intake Modules
 * 
 * Modules:
 * - complaints
 * - cm_fund_requests (Applications)
 * - issues (Public Issues)
 * - ideas
 * - suggestions
 * 
 * Adds:
 * - `submission_source` VARCHAR(50) NOT NULL DEFAULT 'Public Portal'
 * - Index on `(submission_source, created_at)`
 * - Backfill historical records based on `filed_by_admin_id` / `submitted_by_id`
 */

export async function runMigration() {
    const connection = await pool.getConnection();
    try {
        console.log('🚀 Starting Migration 016: Add submission_source to Intake Modules...');
        await connection.beginTransaction();

        const modules = [
            {
                table: 'complaints',
                adminCol: 'filed_by_admin_id',
                indexName: 'idx_complaints_submission_source',
            },
            {
                table: 'cm_fund_requests',
                adminCol: 'submitted_by_id',
                indexName: 'idx_cm_funds_submission_source',
            },
            {
                table: 'issues',
                adminCol: 'filed_by_admin_id',
                indexName: 'idx_issues_submission_source',
            },
            {
                table: 'ideas',
                adminCol: 'filed_by_admin_id',
                indexName: 'idx_ideas_submission_source',
            },
            {
                table: 'suggestions',
                adminCol: 'filed_by_admin_id',
                indexName: 'idx_suggestions_submission_source',
            },
        ];

        for (const mod of modules) {
            console.log(`\n--- Checking table: ${mod.table} ---`);

            // 1. Check if column exists
            const [cols] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = ? 
                  AND COLUMN_NAME = 'submission_source'
            `, [mod.table]);

            if (cols.length === 0) {
                console.log(`Adding submission_source column to ${mod.table}...`);
                await connection.query(`
                    ALTER TABLE ${mod.table}
                    ADD COLUMN submission_source VARCHAR(50) NOT NULL DEFAULT 'Public Portal'
                `);
                console.log(`✓ Added submission_source to ${mod.table}.`);
            } else {
                console.log(`✓ ${mod.table}.submission_source already exists.`);
            }

            // 2. Check index
            const [indexes] = await connection.query(`
                SHOW INDEX FROM ${mod.table} WHERE Key_name = ?
            `, [mod.indexName]);

            if (indexes.length === 0) {
                console.log(`Creating index ${mod.indexName} on ${mod.table}...`);
                await connection.query(`
                    CREATE INDEX ${mod.indexName} ON ${mod.table} (submission_source, created_at)
                `);
                console.log(`✓ Created index ${mod.indexName}.`);
            } else {
                console.log(`✓ Index ${mod.indexName} already exists.`);
            }

            // 3. Backfill historical records
            console.log(`Backfilling submission_source on ${mod.table}...`);
            const [adminUpdate] = await connection.query(`
                UPDATE ${mod.table}
                SET submission_source = 'Admin Panel'
                WHERE ${mod.adminCol} IS NOT NULL
            `);
            const [publicUpdate] = await connection.query(`
                UPDATE ${mod.table}
                SET submission_source = 'Public Portal'
                WHERE ${mod.adminCol} IS NULL
            `);
            console.log(`✓ ${mod.table}: Backfilled ${adminUpdate.affectedRows} as 'Admin Panel', ${publicUpdate.affectedRows} as 'Public Portal'.`);
        }

        await connection.commit();
        console.log('\n✅ Migration 016 completed successfully!');
    } catch (error) {
        await connection.rollback();
        console.error('❌ Migration 016 failed! Transaction rolled back.', error);
        throw error;
    } finally {
        connection.release();
    }
}

// Allow direct execution: `node migrations/016_add_submission_source_to_intake_modules.js`
if (process.argv[1]?.endsWith('016_add_submission_source_to_intake_modules.js')) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
