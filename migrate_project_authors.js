import db from './configs/db.js';

async function migrate() {
    try {
        console.log("Checking if created_by and updated_by columns exist in projects table...");
        const [columns] = await db.query('SHOW COLUMNS FROM projects');
        const hasCreatedBy = columns.some(c => c.Field === 'created_by');
        const hasUpdatedBy = columns.some(c => c.Field === 'updated_by');

        if (!hasCreatedBy) {
            console.log("Adding created_by to projects...");
            await db.query(`ALTER TABLE projects ADD COLUMN created_by INT UNSIGNED DEFAULT NULL`);
        } else {
            console.log("created_by already exists.");
        }

        if (!hasUpdatedBy) {
            console.log("Adding updated_by to projects...");
            await db.query(`ALTER TABLE projects ADD COLUMN updated_by INT UNSIGNED DEFAULT NULL`);
        } else {
            console.log("updated_by already exists.");
        }

        // Add foreign keys
        // We will try adding them. If they exist it'll fail, but that's fine, we'll catch it.
        try {
            await db.query(`ALTER TABLE projects ADD CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL`);
            console.log("Added foreign key fk_projects_created_by");
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log("fk_projects_created_by already exists.");
            } else {
                console.log("Note: Could not add fk_projects_created_by (might already exist):", e.message);
            }
        }

        try {
            await db.query(`ALTER TABLE projects ADD CONSTRAINT fk_projects_updated_by FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL`);
            console.log("Added foreign key fk_projects_updated_by");
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log("fk_projects_updated_by already exists.");
            } else {
                console.log("Note: Could not add fk_projects_updated_by (might already exist):", e.message);
            }
        }

        console.log("Migration complete!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
