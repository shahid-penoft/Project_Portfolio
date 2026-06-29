import pool from './configs/db.js';

async function migrate() {
    try {
        console.log("Migrating complaints table category column...");
        await pool.query(`
            ALTER TABLE complaints 
            MODIFY category VARCHAR(255) NOT NULL DEFAULT 'Other';
        `);
        console.log("Category column modified successfully.");

        console.log("Creating complaint_categories table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS complaint_categories (
                id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
                name            VARCHAR(255)    NOT NULL UNIQUE,
                status          ENUM('Active', 'Inactive') DEFAULT 'Active',
                created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log("complaint_categories table created successfully.");

        // Insert default categories to get started
        console.log("Inserting default categories...");
        const defaultCategories = [
            "Road & Transport", "Water & Sanitation", "Electricity", 
            "Public Safety", "Health", "Education", 
            "Infrastructure", "Environment", "Other"
        ];
        
        for (const cat of defaultCategories) {
            await pool.query(`
                INSERT IGNORE INTO complaint_categories (name) VALUES (?)
            `, [cat]);
        }
        console.log("Default categories inserted.");
        
        console.log("Migration complete.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

migrate();
