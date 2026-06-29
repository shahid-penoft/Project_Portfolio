import db from './configs/db.js';

const runMigration = async () => {
    try {
        console.log('Starting constituent_email_otps migration...');
        
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS constituent_email_otps (
                id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                email      VARCHAR(150) NOT NULL,
                otp        VARCHAR(10)  NOT NULL,
                expires_at DATETIME     NOT NULL,
                is_verified BOOLEAN     NOT NULL DEFAULT 0,
                created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email (email)
            )
        `;
        
        await db.query(createTableQuery);
        console.log('Successfully created constituent_email_otps table.');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
};

runMigration();
