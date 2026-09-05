import pool from '../configs/db.js';

/**
 * Migration 017: Add admin_user_id to communications_logs and update tables
 */
export async function runMigration() {
    const connection = await pool.getConnection();
    try {
        console.log('🚀 Starting Migration 017: Add admin_user_id to communications_logs & update tables...');
        await connection.beginTransaction();

        const tables = [
            'communications_logs',
            'complaint_updates',
            'cm_fund_updates',
            'issue_updates',
            'idea_updates',
            'suggestion_updates'
        ];

        for (const tbl of tables) {
            console.log(`\n--- Checking table: ${tbl} ---`);

            // Check if column exists
            const [cols] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = ? 
                  AND COLUMN_NAME = 'admin_user_id'
            `, [tbl]);

            if (cols.length === 0) {
                console.log(`Adding admin_user_id column to ${tbl}...`);
                await connection.query(`
                    ALTER TABLE ${tbl}
                    ADD COLUMN admin_user_id INT UNSIGNED NULL DEFAULT NULL
                `);
                console.log(`✅ Column admin_user_id added to ${tbl}.`);
            } else {
                console.log(`ℹ️ Column admin_user_id already exists on ${tbl}.`);
            }

            // Check and add index
            const [indices] = await connection.query(`
                SHOW INDEX FROM ${tbl} WHERE Key_name = ?
            `, [`idx_${tbl}_admin_user_id`]);

            if (indices.length === 0) {
                console.log(`Adding index idx_${tbl}_admin_user_id...`);
                await connection.query(`
                    CREATE INDEX idx_${tbl}_admin_user_id ON ${tbl} (admin_user_id)
                `);
                console.log(`✅ Index added.`);
            } else {
                console.log(`ℹ️ Index idx_${tbl}_admin_user_id already exists.`);
            }

            // Add foreign key constraint if it doesn't already exist
            try {
                const fkName = `fk_${tbl}_admin_user`;
                const [fkCheck] = await connection.query(`
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.TABLE_CONSTRAINTS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = ? 
                      AND CONSTRAINT_NAME = ?
                `, [tbl, fkName]);

                if (fkCheck.length === 0) {
                    await connection.query(`
                        ALTER TABLE ${tbl}
                        ADD CONSTRAINT ${fkName}
                        FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
                        ON DELETE SET NULL
                    `);
                    console.log(`✅ Foreign key constraint ${fkName} added.`);
                }
            } catch (fkErr) {
                console.log(`ℹ️ Foreign key constraint note on ${tbl}: ${fkErr.message}`);
            }
        }

        console.log('\n--- Running Backfill for historical records ---');
        // Backfill Complaint initial comms
        await connection.query(`
            UPDATE communications_logs cl
            JOIN complaints c ON cl.entity_type = 'Complaint' AND (
                cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci 
                OR cl.entity_id COLLATE utf8mb4_unicode_ci = c.reference_no COLLATE utf8mb4_unicode_ci
            )
            SET cl.admin_user_id = c.filed_by_admin_id
            WHERE cl.admin_user_id IS NULL AND c.filed_by_admin_id IS NOT NULL
        `).catch(e => console.warn('Complaint backfill warning:', e.message));

        // Backfill Application initial comms
        await connection.query(`
            UPDATE communications_logs cl
            JOIN cm_fund_requests r ON (cl.entity_type = 'Application' OR cl.entity_type = 'CM_Fund' OR cl.entity_type = 'cm_fund') 
              AND cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(r.id AS CHAR) COLLATE utf8mb4_unicode_ci
            SET cl.admin_user_id = r.submitted_by_id
            WHERE cl.admin_user_id IS NULL AND r.submitted_by_id IS NOT NULL
        `).catch(e => console.warn('Application backfill warning:', e.message));

        // Backfill Issues initial comms
        await connection.query(`
            UPDATE communications_logs cl
            JOIN issues i ON cl.entity_type = 'Issue' AND (
                cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(i.id AS CHAR) COLLATE utf8mb4_unicode_ci 
                OR cl.entity_id COLLATE utf8mb4_unicode_ci = i.reference_no COLLATE utf8mb4_unicode_ci
            )
            SET cl.admin_user_id = i.filed_by_admin_id
            WHERE cl.admin_user_id IS NULL AND i.filed_by_admin_id IS NOT NULL
        `).catch(e => console.warn('Issues backfill warning:', e.message));

        // Backfill Ideas initial comms
        await connection.query(`
            UPDATE communications_logs cl
            JOIN ideas d ON cl.entity_type = 'Idea' AND (
                cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(d.id AS CHAR) COLLATE utf8mb4_unicode_ci 
                OR cl.entity_id COLLATE utf8mb4_unicode_ci = d.reference_no COLLATE utf8mb4_unicode_ci
            )
            SET cl.admin_user_id = d.filed_by_admin_id
            WHERE cl.admin_user_id IS NULL AND d.filed_by_admin_id IS NOT NULL
        `).catch(e => console.warn('Ideas backfill warning:', e.message));

        // Backfill Suggestions initial comms
        await connection.query(`
            UPDATE communications_logs cl
            JOIN suggestions s ON cl.entity_type = 'Suggestion' AND (
                cl.entity_id COLLATE utf8mb4_unicode_ci = CAST(s.id AS CHAR) COLLATE utf8mb4_unicode_ci 
                OR cl.entity_id COLLATE utf8mb4_unicode_ci = s.reference_no COLLATE utf8mb4_unicode_ci
            )
            SET cl.admin_user_id = s.filed_by_admin_id
            WHERE cl.admin_user_id IS NULL AND s.filed_by_admin_id IS NOT NULL
        `).catch(e => console.warn('Suggestions backfill warning:', e.message));

        // Backfill CM Fund timeline follow-up events
        await connection.query(`
            UPDATE cm_fund_updates u
            JOIN cm_fund_timeline_events t ON t.request_id COLLATE utf8mb4_unicode_ci = u.request_id COLLATE utf8mb4_unicode_ci
              AND t.event_type = 'Follow-up Added' 
              AND ABS(TIMESTAMPDIFF(SECOND, t.created_at, u.created_at)) <= 10
            SET u.admin_user_id = t.actor_id
            WHERE u.admin_user_id IS NULL AND t.actor_id IS NOT NULL
        `).catch(e => console.warn('CM Fund updates backfill warning:', e.message));

        await connection.query(`
            UPDATE communications_logs cl
            JOIN cm_fund_timeline_events t ON t.request_id COLLATE utf8mb4_unicode_ci = cl.entity_id COLLATE utf8mb4_unicode_ci
              AND ABS(TIMESTAMPDIFF(SECOND, t.created_at, cl.created_at)) <= 10
            SET cl.admin_user_id = t.actor_id
            WHERE cl.admin_user_id IS NULL AND t.actor_id IS NOT NULL
        `).catch(e => console.warn('CM Fund comm logs backfill warning:', e.message));

        await connection.commit();
        console.log('\n✅ Migration 017 completed successfully!');
    } catch (err) {
        await connection.rollback();
        console.error('❌ Migration 017 failed:', err);
        throw err;
    } finally {
        connection.release();
    }
}

// Direct execution
if (process.argv[1] && process.argv[1].endsWith('017_add_admin_user_id_to_comm_and_updates.js')) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
