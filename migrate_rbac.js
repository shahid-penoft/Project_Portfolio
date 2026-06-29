import db from './configs/db.js';

async function migrate() {
    try {
        console.log('Starting RBAC migration...');

        // 1. Create roles table
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_roles (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                permissions JSON NOT NULL,
                is_system BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('Created admin_roles table.');

        // 2. Insert default roles
        // We will seed 3 roles matching the previous ENUM: superadmin, admin, editor
        const allPermissions = [
            'dashboard', 'projects', 'complaints', 'schemes', 'tourism', 'enquiries', 'impact_metrics', 'jobs',
            'home', 'about', 'constituency', 'ente_nadu', 'manifesto', 'events', 'media', 'gallery', 'site_settings'
        ];
        
        const superadminPerms = JSON.stringify(allPermissions);
        const adminPerms = JSON.stringify(['dashboard', 'projects', 'complaints', 'schemes', 'tourism', 'enquiries', 'events']); // example
        const editorPerms = JSON.stringify(['dashboard', 'projects', 'events', 'media', 'gallery']); // example

        await db.query(`
            INSERT IGNORE INTO admin_roles (name, permissions, is_system) 
            VALUES 
            ('Superadmin', ?, 1),
            ('Admin', ?, 0),
            ('Editor', ?, 0)
        `, [superadminPerms, adminPerms, editorPerms]);
        console.log('Inserted default roles.');

        // 3. Add role_id to admin_users if it doesn't exist
        const [columns] = await db.query("SHOW COLUMNS FROM admin_users LIKE 'role_id'");
        if (columns.length === 0) {
            await db.query(`ALTER TABLE admin_users ADD COLUMN role_id INT UNSIGNED DEFAULT NULL AFTER password`);
            await db.query(`ALTER TABLE admin_users ADD CONSTRAINT fk_admin_role FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE SET NULL`);
            console.log('Added role_id to admin_users.');
        } else {
            console.log('role_id already exists in admin_users.');
        }

        // 4. Migrate existing users based on their ENUM role
        // Need to match lowercase ENUM values ('superadmin', 'admin', 'editor') to the new roles
        await db.query(`
            UPDATE admin_users u
            JOIN admin_roles r ON LOWER(r.name) = u.role
            SET u.role_id = r.id
            WHERE u.role_id IS NULL
        `);
        console.log('Migrated existing users to use role_id.');

        // 5. Check if any users failed to migrate (maybe custom roles?)
        const [unmigrated] = await db.query(`SELECT id, email, role FROM admin_users WHERE role_id IS NULL`);
        if (unmigrated.length > 0) {
            console.warn(`WARNING: ${unmigrated.length} users could not be mapped to a role automatically.`);
            console.warn('You should manually assign them a role_id before dropping the ENUM column.');
        } else {
            // Optional: Drop the old ENUM column
            const [oldRoleCol] = await db.query("SHOW COLUMNS FROM admin_users LIKE 'role'");
            if (oldRoleCol.length > 0) {
                await db.query(`ALTER TABLE admin_users DROP COLUMN role`);
                console.log('Dropped old role ENUM column from admin_users.');
            }
        }

        console.log('RBAC migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
