import 'dotenv/config';
import pool from '../configs/db.js';

const sql = `
CREATE TABLE IF NOT EXISTS contact_enquiries (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(150)    NOT NULL,
    mobile          VARCHAR(20)     NOT NULL,
    email           VARCHAR(200)    NOT NULL,
    panchayat_id    INT UNSIGNED    DEFAULT NULL,
    category        ENUM('membership','local issues','submit ideas','submit opinions','general')
                                    NOT NULL DEFAULT 'general',
    subject         VARCHAR(255)    DEFAULT NULL,
    message         TEXT            NOT NULL,
    status          ENUM('new','read','resolved')
                                    NOT NULL DEFAULT 'new',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_enq_local_body FOREIGN KEY (panchayat_id)
        REFERENCES local_bodies(id) ON DELETE SET NULL,
    INDEX idx_status    (status),
    INDEX idx_category  (category),
    INDEX idx_created   (created_at)
)
`;

try {
    await pool.query(sql);
    console.log('✅  contact_enquiries table created / already exists.');
    process.exit(0);
} catch (e) {
    console.error('❌  Error:', e.message);
    process.exit(1);
}
