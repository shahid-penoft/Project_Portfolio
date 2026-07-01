import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

async function check() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await connection.query('DESCRIBE admin_users');
        console.log('admin_users schema:', rows);
        const [rows2] = await connection.query('DESCRIBE constituents');
        console.log('constituents schema:', rows2);
    } catch(err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}
check();
