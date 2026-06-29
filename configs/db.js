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

// Test connection on startup
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅  Database connected successfully');
        conn.release();
    } catch (err) {
        console.error('❌  Database connection failed:', err.message);
        process.exit(1);
    }
})();

export default pool;
