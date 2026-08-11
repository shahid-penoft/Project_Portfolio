import cron from 'node-cron';
import pool from '../configs/db.js';
import { processBulkJob } from '../controllers/notificationsController.js';

export const initScheduler = () => {
    // Run every minute at the 0th second
    cron.schedule('* * * * *', async () => {
        try {
            // Fetch jobs that are scheduled to run now or in the past
            const [jobs] = await pool.query(
                "SELECT * FROM bulk_send_jobs WHERE status = 'scheduled' AND scheduled_at <= NOW()"
            );

            for (const job of jobs) {
                // Update status to 'queued' to prevent double-processing
                await pool.query("UPDATE bulk_send_jobs SET status = 'queued' WHERE id = ?", [job.id]);
                
                let payload = job.payload;
                let channels = job.channels;

                try {
                    if (typeof payload === 'string') payload = JSON.parse(payload);
                    if (typeof channels === 'string') channels = JSON.parse(channels);
                } catch (e) {
                    console.error(`[Scheduler] Failed to parse payload for job ${job.id}`, e);
                    await pool.query("UPDATE bulk_send_jobs SET status = 'failed', error_log = ? WHERE id = ?", [JSON.stringify([{ error: 'Invalid payload JSON' }]), job.id]);
                    continue;
                }

                if (!payload || !payload.contacts) {
                    await pool.query("UPDATE bulk_send_jobs SET status = 'failed', error_log = ? WHERE id = ?", [JSON.stringify([{ error: 'Missing contacts in payload' }]), job.id]);
                    continue;
                }

                // Execute the bulk send in the background
                setImmediate(() => {
                    console.log(`[Scheduler] Triggering scheduled job ${job.id}`);
                    processBulkJob({ 
                        jobId: job.id, 
                        contacts: payload.contacts, 
                        channels,
                        messages: payload.messages,
                        subject: payload.subject
                    }).catch(err => {
                        console.error(`[Scheduler] Unhandled error in scheduled processBulkJob for ${job.id}:`, err.message);
                        pool.query(
                            "UPDATE bulk_send_jobs SET status='failed', completed_at=NOW() WHERE id=?",
                            [job.id]
                        ).catch(() => {});
                    });
                });
            }
        } catch (err) {
            console.error('[Scheduler] Error processing scheduled jobs:', err);
        }
    });
};
