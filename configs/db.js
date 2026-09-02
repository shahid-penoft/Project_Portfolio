import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',

    // --- add these ---
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,   // start sending TCP keep-alive pings after 10s idle
    connectTimeout: 10000,          // fail fast on a dead connection attempt instead of hanging
});

// Test connection on startup and ensure schema compatibility
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅  Database connected successfully');

        // Ensure sms_sent and sms_body columns exist on all update tables safely
        const tables = ['idea_updates', 'complaint_updates', 'issue_updates', 'suggestion_updates'];
        for (const table of tables) {
            try {
                const [cols] = await conn.query(
                    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
                    [table]
                );
                const colNames = cols.map(c => c.COLUMN_NAME);
                if (!colNames.includes('sms_sent')) {
                    await conn.query(`ALTER TABLE ${table} ADD COLUMN sms_sent TINYINT(1) DEFAULT 0`);
                    console.log(`[Schema] Added sms_sent column to ${table}`);
                }
                if (!colNames.includes('sms_body')) {
                    await conn.query(`ALTER TABLE ${table} ADD COLUMN sms_body TEXT NULL`);
                    console.log(`[Schema] Added sms_body column to ${table}`);
                }
            } catch (err) {
                console.warn(`[Schema] Check for ${table} skipped:`, err.message);
            }
        }

        conn.release();
    } catch (err) {
        console.error('❌  Database connection failed:', err.message);
        process.exit(1);
    }
})();

export default pool;
