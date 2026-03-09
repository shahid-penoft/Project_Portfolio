import 'dotenv/config';
import mysql from 'mysql2/promise';

async function fixMigration() {
    const connectionOptions = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    };

    console.log(`Connecting to database: ${connectionOptions.database}...`);
    const connection = await mysql.createConnection(connectionOptions);

    try {
        console.log('Checking current columns in kothamangalam_gallery...');
        const [columns] = await connection.query('SHOW COLUMNS FROM kothamangalam_gallery');
        const columnNames = columns.map(c => c.Field);
        console.log('Existing columns:', columnNames.join(', '));

        if (!columnNames.includes('video_type')) {
            console.log('Column "video_type" is missing. Adding it now...');
            await connection.query(`
                ALTER TABLE kothamangalam_gallery 
                ADD COLUMN video_type ENUM('upload', 'url') NOT NULL DEFAULT 'upload' 
                AFTER media_type
            `);
            console.log('✅  Column "video_type" added successfully.');
        } else {
            console.log('Column "video_type" already exists.');
        }

        // Final check
        const [finalColumns] = await connection.query('SHOW COLUMNS FROM kothamangalam_gallery');
        console.log('Final columns:', finalColumns.map(c => c.Field).join(', '));

    } catch (err) {
        console.error('❌  Error during migration:', err.message);
    } finally {
        await connection.end();
    }
}

fixMigration();
