import pool from './configs/db.js';

const tables = ['complaints', 'issues', 'ideas', 'suggestions'];

async function addIndexIfMissing(table, indexName, column) {
    const [rows] = await pool.query(
        `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
        [indexName]
    );
    if (rows.length === 0) {
        await pool.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (\`${column}\`)`);
        console.log(`✅ Added ${indexName} on ${table}.${column}`);
    } else {
        console.log(`⏭  ${indexName} already exists on ${table}`);
    }
}

async function run() {
    try {
        for (const table of tables) {
            await addIndexIfMissing(table, 'idx_ref_no', 'reference_no');
            await addIndexIfMissing(table, 'idx_phone', 'phone');
        }
        console.log('Index migration complete.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit(0);
    }
}

run();
