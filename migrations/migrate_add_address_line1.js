import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function runMigration() {
    try {
        console.log('Adding address_line1 to complaints...');
        await pool.query(`ALTER TABLE complaints ADD COLUMN address_line1 VARCHAR(255) NULL AFTER ward_id;`);
        console.log('Success: complaints');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') console.log('Column address_line1 already exists in complaints');
        else console.error('Error on complaints:', err);
    }

    try {
        console.log('Adding address_line1 to suggestions...');
        await pool.query(`ALTER TABLE suggestions ADD COLUMN address_line1 VARCHAR(255) NULL AFTER ward_id;`);
        console.log('Success: suggestions');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') console.log('Column address_line1 already exists in suggestions');
        else console.error('Error on suggestions:', err);
    }

    try {
        console.log('Adding address_line1 to ideas...');
        await pool.query(`ALTER TABLE ideas ADD COLUMN address_line1 VARCHAR(255) NULL AFTER ward_id;`);
        console.log('Success: ideas');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') console.log('Column address_line1 already exists in ideas');
        else console.error('Error on ideas:', err);
    }

    console.log('Migration completed.');
    process.exit(0);
}

runMigration();
