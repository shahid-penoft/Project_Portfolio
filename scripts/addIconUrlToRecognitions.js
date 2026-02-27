import pool from '../configs/db.js';

/**
 * Migration: Add icon_url column to recognitions table
 */

const addIconUrlColumn = async () => {
    try {
        console.log('Starting migration...');
        
        // Check if column already exists
        console.log('Checking if icon_url column exists...');
        const [columns] = await pool.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='recognitions' AND COLUMN_NAME='icon_url'"
        );
        console.log('Column check result:', columns.length);

        if (columns.length > 0) {
            console.log('✅ icon_url column already exists.');
            return;
        }

        // Add column
        console.log('Adding icon_url column...');
        await pool.query(`
            ALTER TABLE recognitions 
            ADD COLUMN icon_url VARCHAR(500) DEFAULT NULL
        `);

        console.log('✅ icon_url column added to recognitions table.');
    } catch (error) {
        console.error('❌ Error adding icon_url column:', error.message);
        throw error;
    }
};

addIconUrlColumn().then(() => {
    console.log('Migration completed.');
    process.exit(0);
}).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
