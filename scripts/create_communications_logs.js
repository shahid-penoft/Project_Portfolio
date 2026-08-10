import pool from '../configs/db.js';

const createTable = async () => {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS communications_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT NOT NULL,
                channel VARCHAR(20) NOT NULL,
                recipient VARCHAR(255) NULL,
                message TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_entity (entity_type, entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        
        await pool.query(query);
        console.log('✅ Table communications_logs created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to create table communications_logs:', err);
        process.exit(1);
    }
};

createTable();
