import pool from '../configs/db.js';

async function migrate() {
    try {
        console.log("Creating departments table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT DEFAULT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);
        console.log("Departments table created.");

        console.log("Adding department_id to projects...");
        try {
            await pool.query(`
                ALTER TABLE projects
                ADD COLUMN department_id INT UNSIGNED DEFAULT NULL;
            `);
            console.log("department_id added.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log("department_id already exists.");
            } else {
                throw e;
            }
        }

        console.log("Adding foreign key to projects...");
        try {
            await pool.query(`
                ALTER TABLE projects
                ADD CONSTRAINT fk_project_department
                FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
            `);
            console.log("Foreign key added.");
        } catch (e) {
            if (e.code === 'ER_DUP_KEY' || e.code === 'ER_CANT_CREATE_TABLE' || e.message.includes('Duplicate')) {
                console.log("Foreign key already exists or error: " + e.message);
            } else {
                throw e;
            }
        }
        
        console.log("Migration complete.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

migrate();
