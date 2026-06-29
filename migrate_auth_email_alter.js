import db from './configs/db.js';

const migrate = async () => {
    try {
        console.log('Altering constituent_users...');
        
        try {
            await db.query('ALTER TABLE constituent_users DROP COLUMN verification_method');
            await db.query('ALTER TABLE constituent_users DROP COLUMN verification_id');
        } catch (e) {
            console.log('Columns might already be dropped or missing.', e.message);
        }

        try {
            await db.query('ALTER TABLE constituent_users MODIFY phone VARCHAR(20) DEFAULT NULL');
            await db.query('ALTER TABLE constituent_users DROP INDEX phone'); // Drop unique index if it exists
        } catch (e) {
            console.log('Phone column modify or index drop failed (might already be done).', e.message);
        }

        try {
            // Delete existing rows that have NULL emails or duplicate emails to allow unique constraint, since we are allowed to wipe
            await db.query('DELETE FROM constituent_users');
            
            await db.query('ALTER TABLE constituent_users MODIFY email VARCHAR(150) NOT NULL');
            await db.query('ALTER TABLE constituent_users ADD UNIQUE INDEX idx_email (email)');
        } catch (e) {
            console.log('Email modify failed.', e.message);
        }

        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrate();
