import db from './configs/db.js';

const migrate = async () => {
    try {
        console.log('Starting admin_activity_logs migration...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_activity_logs (
                id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
                admin_user_id INT UNSIGNED DEFAULT NULL,
                action        VARCHAR(100) NOT NULL,
                module        VARCHAR(100) NOT NULL,
                details       TEXT         NOT NULL,
                severity      ENUM('info','success','warning','error','neutral') NOT NULL DEFAULT 'info',
                ip_address    VARCHAR(45)  DEFAULT NULL,
                user_agent    TEXT         DEFAULT NULL,
                resource      VARCHAR(500) DEFAULT NULL,
                created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_aal_user    (admin_user_id),
                KEY idx_aal_module  (module),
                KEY idx_aal_action  (action),
                KEY idx_aal_created (created_at),
                CONSTRAINT fk_aal_user FOREIGN KEY (admin_user_id)
                    REFERENCES admin_users (id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log('✅ Migration completed: admin_activity_logs table created.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrate();
