import pool from '../configs/db.js';

/**
 * Migration: Add icon_url column to achievements table
 */

const addIconUrlColumn = async () => {
    try {
        // Check if column already exists
        const [columns] = await pool.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='achievements' AND COLUMN_NAME='icon_url'"
        );

        if (columns.length > 0) {
            console.log('✅ icon_url column already exists.');
            return;
        }

        // Add column
        await pool.query(`
            ALTER TABLE achievements 
            ADD COLUMN icon_url VARCHAR(500) DEFAULT NULL
        `);

        console.log('✅ icon_url column added to achievements table.');
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
