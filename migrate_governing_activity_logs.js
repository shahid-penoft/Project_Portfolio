import db from './configs/db.js';

const migrate = async () => {
    try {
        console.log('Starting governing_body_activity_logs migration...');

        const query = `
            CREATE TABLE IF NOT EXISTS governing_body_activity_logs (
                id int unsigned NOT NULL AUTO_INCREMENT,
                governing_body_id int unsigned NOT NULL,
                admin_user_id int unsigned DEFAULT NULL,
                text text NOT NULL,
                created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY admin_user_id (admin_user_id),
                KEY idx_gov_log (governing_body_id),
                CONSTRAINT gov_log_ibfk_1 FOREIGN KEY (governing_body_id) REFERENCES governing_representatives (id) ON DELETE CASCADE,
                CONSTRAINT gov_log_ibfk_2 FOREIGN KEY (admin_user_id) REFERENCES admin_users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `;

        await db.query(query);
        console.log('Migration completed: governing_body_activity_logs table created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
