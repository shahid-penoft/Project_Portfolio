import pool from './configs/db.js';

const migrate = async () => {
    try {
        console.log("Starting migration...");
        
        console.log("Adding affected_by and resolved_date columns...");
        try {
            await pool.query("ALTER TABLE issues ADD COLUMN affected_by INT NULL, ADD COLUMN resolved_date DATE NULL;");
            console.log("Columns added.");
        } catch(e) {
            console.log("Columns might already exist or error:", e.message);
        }

        console.log("Dropping issue_scope column...");
        try {
            await pool.query("ALTER TABLE issues DROP COLUMN issue_scope;");
            console.log("Column dropped.");
        } catch(e) {
            console.log("Column might already be dropped or error:", e.message);
        }

        console.log("Migration complete.");
    } catch(err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit(0);
    }
};

migrate();
