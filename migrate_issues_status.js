import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diavets_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function migrate() {
    try {
        console.log('Altering issues table...');
        await pool.query(`
            ALTER TABLE issues
            MODIFY status ENUM('Pending', 'Under Process', 'Not Attended', 'Resolved', 'Escalated', 'Draft') NOT NULL DEFAULT 'Pending'
        `);
        console.log('✅ Added Draft to issues status enum');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
