import pool from '../configs/db.js';

/**
 * Migration: Add enquiry_communications table to track SMS, WhatsApp, and Voice messages
 */

const createCommunicationsTable = async () => {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS enquiry_communications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                enquiry_id INT UNSIGNED NOT NULL,
                type ENUM('email', 'sms', 'whatsapp', 'voice') NOT NULL,
                recipient VARCHAR(255) NOT NULL,
                message LONGTEXT,
                status ENUM('sent', 'failed', 'pending') DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (enquiry_id) REFERENCES contact_enquiries(id) ON DELETE CASCADE,
                INDEX idx_enquiry_id (enquiry_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await pool.query(query);
        console.log('✅ enquiry_communications table created successfully.');
    } catch (error) {
        console.error('❌ Error creating enquiry_communications table:', error.message);
        throw error;
    }
};

createCommunicationsTable().then(() => {
    console.log('Migration completed.');
    process.exit(0);
}).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
