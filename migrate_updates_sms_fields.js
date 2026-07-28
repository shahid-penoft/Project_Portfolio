import pool from './configs/db.js';

const tables = ['complaint_updates', 'issue_updates', 'idea_updates', 'suggestion_updates'];

async function addColumnIfMissing(table, colName, colSpec) {
    const [rows] = await pool.query(
        `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
        [colName]
    );
    if (rows.length === 0) {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` ${colSpec}`);
        console.log(`✅ Added ${colName} to ${table}`);
    } else {
        console.log(`⏭  ${colName} already exists on ${table}`);
    }
}

async function run() {
    try {
        for (const table of tables) {
            await addColumnIfMissing(table, 'sms_sent', 'TINYINT(1) DEFAULT 0');
            await addColumnIfMissing(table, 'sms_body', 'TEXT DEFAULT NULL');
        }
        console.log('🎉 Migration of SMS fields on petition updates tables complete.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        process.exit(0);
    }
}

run();
