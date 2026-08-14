import pool from '../configs/db.js';

/**
 * Migration Script: Support string entity_id in communications_logs & match standard collation.
 * 
 * Usage:
 *   1. Auto-detect and fix all application logs:
 *      node scripts/migrate_application_comm_logs.js
 * 
 *   2. Pass specific Application IDs to link:
 *      node scripts/migrate_application_comm_logs.js F-CM-019 F-CM-091
 */

async function runMigration() {
    const connection = await pool.getConnection();
    try {
        console.log('🚀 [Migration] Starting Application Communications Logs Migration...');

        // Step 1: Alter communications_logs collation and entity_id to match entity tables (utf8mb4_0900_ai_ci)
        console.log('1️⃣ Modifying communications_logs table collation and entity_id to VARCHAR(100) COLLATE utf8mb4_0900_ai_ci...');
        await connection.query(`
            ALTER TABLE communications_logs 
            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
        `);
        await connection.query(`
            ALTER TABLE communications_logs 
            MODIFY COLUMN entity_id VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL
        `);
        console.log('✅ Column entity_id successfully altered with matching collation.');

        // Step 2: Handle provided Application IDs or auto-detect from logs
        const specificIds = process.argv.slice(2);

        if (specificIds.length > 0) {
            console.log(`\n2️⃣ Linking communications for specific IDs: ${specificIds.join(', ')}...`);
            for (const appId of specificIds) {
                const [result] = await connection.query(`
                    UPDATE communications_logs
                    SET entity_id = ?, entity_type = 'Application'
                    WHERE (entity_id = '0' OR entity_id = '' OR entity_id = 0)
                      AND (message LIKE ? OR message LIKE ?)
                `, [appId, `%${appId}%`, `%Tracking ID: ${appId}%`]);

                console.log(`   👉 App ID [${appId}]: matched and updated ${result.affectedRows} log record(s).`);
            }
        } else {
            console.log('\n2️⃣ Auto-detecting and linking Application logs with entity_id = 0...');
            const [logs] = await connection.query(`
                SELECT id, message 
                FROM communications_logs 
                WHERE entity_type = 'Application' 
                  AND (entity_id = '0' OR entity_id = '' OR entity_id = 0)
            `);

            console.log(`   Found ${logs.length} application log record(s) with entity_id = 0.`);
            let updatedCount = 0;

            for (const log of logs) {
                const match = log.message.match(/Tracking ID:\s*([A-Za-z0-9_-]+)/i) || 
                              log.message.match(/\b(F-[A-Za-z0-9_-]+)\b/i);

                if (match && match[1]) {
                    const extractedId = match[1].trim();
                    await connection.query(`
                        UPDATE communications_logs 
                        SET entity_id = ? 
                        WHERE id = ?
                    `, [extractedId, log.id]);
                    console.log(`   ✅ Log #${log.id} -> Linked to Application ID [${extractedId}]`);
                    updatedCount++;
                } else {
                    console.log(`   ⚠️ Log #${log.id}: Could not auto-detect Tracking ID from message.`);
                }
            }

            console.log(`✅ Auto-linked ${updatedCount} log record(s).`);
        }

        console.log('\n🎉 Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        connection.release();
        process.exit(0);
    }
}

runMigration();
