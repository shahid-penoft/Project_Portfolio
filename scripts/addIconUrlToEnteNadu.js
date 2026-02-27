import pool from '../configs/db.js';

/**
 * Migration: Add icon_url column to ente_nadu_cards table
 */

const addIconUrlColumn = async () => {
    try {
        // Check if column already exists
        const [columns] = await pool.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ente_nadu_cards' AND COLUMN_NAME='icon_url'"
        );

        if (columns.length > 0) {
            console.log('✅ icon_url column already exists.');
            return;
        }

        // Add column after icon_name
        await pool.query(`
            ALTER TABLE ente_nadu_cards 
            ADD COLUMN icon_url VARCHAR(500) DEFAULT NULL 
            AFTER icon_name
        `);

        console.log('✅ icon_url column added to ente_nadu_cards table.');
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
