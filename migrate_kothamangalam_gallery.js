import db from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Starting migration for Kothamangalam Gallery...');

        const query = `
            CREATE TABLE IF NOT EXISTS kothamangalam_gallery (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                media_type ENUM('photo', 'video') NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT DEFAULT NULL,
                file_url VARCHAR(500) NOT NULL,
                thumbnail_url VARCHAR(500) DEFAULT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_media_type (media_type),
                INDEX idx_created (created_at)
            );
        `;

        await db.query(query);
        console.log('✅ kothamangalam_gallery table created successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit(0);
    }
};

runMigration();
