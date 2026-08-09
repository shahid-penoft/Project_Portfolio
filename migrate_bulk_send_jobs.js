import pool from './configs/db.js';

/**
 * Migration: create bulk_send_jobs table
 *
 * Stores the state of every bulk-send job kicked off from the
 * Communications page.  The backend processes each job asynchronously
 * in the background and writes progress updates here so the frontend
 * can poll for status.
 */
const migrate = async () => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            CREATE TABLE IF NOT EXISTS bulk_send_jobs (
                id              VARCHAR(36)  NOT NULL PRIMARY KEY,
                admin_id        INT          NOT NULL,
                status          ENUM(
                                    'queued',
                                    'running',
                                    'completed',
                                    'partial_failure',
                                    'failed',
                                    'cancelled'
                                )            NOT NULL DEFAULT 'queued',
                channels        JSON         NOT NULL COMMENT 'e.g. {"sms":true,"email":false,"whatsapp":false}',
                total_count     INT          NOT NULL DEFAULT 0,
                sent_count      INT          NOT NULL DEFAULT 0,
                failed_count    INT          NOT NULL DEFAULT 0,
                error_log       JSON         NULL COMMENT 'Array of {contactId, channel, error}',
                created_at      DATETIME     NOT NULL DEFAULT NOW(),
                updated_at      DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
                completed_at    DATETIME     NULL,
                INDEX idx_bsj_status     (status),
                INDEX idx_bsj_admin      (admin_id),
                INDEX idx_bsj_created   (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await conn.commit();
        console.log('✅  bulk_send_jobs table created (or already exists).');
    } catch (err) {
        await conn.rollback();
        console.error('❌  Migration failed:', err.message);
        process.exit(1);
    } finally {
        conn.release();
        await pool.end();
    }
};

migrate();
