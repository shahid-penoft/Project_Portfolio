import pool from './configs/db.js';

async function migrate() {
    try {
        await pool.query('ALTER TABLE mla_letters ADD COLUMN trashed_at DATETIME DEFAULT NULL');
        console.log('✅ Added trashed_at');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') console.log('⚠️ trashed_at already exists');
        else console.error('❌ Error adding trashed_at:', err.message);
    }
    
    try {
        await pool.query('ALTER TABLE mla_letters ADD COLUMN trashed_by_id INT DEFAULT NULL');
        console.log('✅ Added trashed_by_id');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') console.log('⚠️ trashed_by_id already exists');
        else console.error('❌ Error adding trashed_by_id:', err.message);
    }
    
    process.exit(0);
}

migrate();
