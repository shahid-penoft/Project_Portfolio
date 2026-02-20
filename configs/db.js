import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diavets_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
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
