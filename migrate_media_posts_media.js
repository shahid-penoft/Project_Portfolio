import db from './configs/db.js';

async function migrate() {
    try {
        console.log('🚀 Starting migration: Adding images and videos columns to media_posts...');
        
        // 1. Check if column exists
        const [columns] = await db.query('SHOW COLUMNS FROM media_posts');
        const columnNames = columns.map(c => c.Field);
        
        if (!columnNames.includes('images')) {
            await db.query('ALTER TABLE media_posts ADD COLUMN images LONGTEXT AFTER thumbnail_url');
            console.log('✅ Column "images" added successfully.');
        } else {
            console.log('ℹ️ Column "images" already exists.');
        }

        if (!columnNames.includes('videos')) {
            await db.query('ALTER TABLE media_posts ADD COLUMN videos LONGTEXT AFTER images');
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
