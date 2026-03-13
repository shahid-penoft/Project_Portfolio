import db from './configs/db.js';

async function migrate() {
    try {
        console.log('🚀 Starting migration: Adding videos column to projects...');
        
        // 1. Check if column exists
        const [columns] = await db.query('SHOW COLUMNS FROM projects LIKE "videos"');
        
        if (columns.length === 0) {
            await db.query('ALTER TABLE projects ADD COLUMN videos LONGTEXT AFTER images');
            console.log('✅ Column "videos" added successfully.');
        } else {
            console.log('ℹ️ Column "videos" already exists.');
        }
        
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
