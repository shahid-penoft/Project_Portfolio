import { randomUUID } from 'crypto';
import { sendSMS } from '../services/smsService.js';
import { sendNotificationEmail } from '../utils/email.js';
import { sendWhatsAppMessage } from '../configs/whatsapp.js';
import { followUpUpdateSMS, followUpUpdateWhatsApp, followUpUpdateEmail } from '../services/smsTemplates.js';
import pool from '../configs/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications/sms
// Body: { to, message, record_id, record_type }
// ─────────────────────────────────────────────────────────────────────────────
export const sendSMSNotification = async (req, res) => {
    try {
        const { to, message, record_id, record_type } = req.body;

        if (!to || !message) {
            return res.status(400).json({
                success: false,
                message: '"to" (phone) and "message" are required.',
            });
        }

        const result = await sendSMS(to, message);

        console.log(
            `[SMS] ✅ Sent to ${to} | ${record_type || 'unknown'} #${record_id || '—'} | Admin: ${req.admin?.full_name || 'system'}`
        );

        res.json({ success: true, message: 'SMS sent successfully.', data: result });
    } catch (err) {
        const errMsg = err?.response?.body?.message || err?.response?.data?.message || err.message;
        console.error('[SMS] ❌ Send failed:', errMsg);
        res.status(500).json({
            success: false,
            message: 'Failed to send SMS.',
            error: errMsg,
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications/sms/status
// Returns whether the SMS service is properly configured
// ─────────────────────────────────────────────────────────────────────────────
export const getSMSStatus = (req, res) => {
    const configured = !!(process.env.BREVO_API_KEY && process.env.BREVO_SMS_SENDER);
    res.json({
        success: true,
        configured,
        sender: process.env.BREVO_SMS_SENDER || null,
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications/email
// Body: { to, message, subject }
// ─────────────────────────────────────────────────────────────────────────────
export const sendEmailNotification = async (req, res) => {
    try {
        const { to, message, subject } = req.body;

        if (!to || !message) {
            return res.status(400).json({
                success: false,
                message: '"to" (email) and "message" are required.',
            });
        }

        await sendNotificationEmail({
            to,
            subject: subject || 'Update from MLA Connect',
            message: message,
        });

        console.log(`[Email] ✅ Sent to ${to} | Admin: ${req.admin?.full_name || 'system'}`);

        res.json({ success: true, message: 'Email sent successfully.' });
    } catch (err) {
        console.error('[Email] ❌ Send failed:', err.message);
        res.status(500).json({ success: false, message: 'Failed to send Email.', error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications/whatsapp
// Body: { to, message }
// ─────────────────────────────────────────────────────────────────────────────
export const sendWhatsAppNotification = async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({
                success: false,
                message: '"to" (phone) and "message" are required.',
            });
        }

        let phone = to.trim();
        if (phone.startsWith('+')) phone = phone.substring(1);
        if (phone.startsWith('0')) phone = '91' + phone.substring(1);
        if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;

        const result = await sendWhatsAppMessage(phone, message);

        console.log(`[WhatsApp] ✅ Sent to ${to} | Admin: ${req.admin?.full_name || 'system'}`);

        res.json({ success: true, message: 'WhatsApp message sent successfully.', data: result });
    } catch (err) {
        console.error('[WhatsApp] ❌ Send failed:', err.message);
        res.status(500).json({ success: false, message: 'Failed to send WhatsApp message.', error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK SEND  ──  POST /api/notifications/bulk-send
//
// Accepts a list of contacts + channels.
// Returns 202 immediately with a jobId; processing happens in the background
// using adaptive batching with Brevo rate-limit protection.
//
// Body:
// {
//   contacts: [{ id, module, phone?, email?, name, trackingId }],
//   channels: { sms: bool, email: bool, whatsapp: bool }
// }
// ─────────────────────────────────────────────────────────────────────────────
export const sendBulkNotification = async (req, res) => {
    const { contacts, channels } = req.body;

    // ── Validate ────────────────────────────────────────────────
    if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ success: false, message: 'contacts array is required.' });
    }
    if (!channels || (!channels.sms && !channels.email && !channels.whatsapp)) {
        return res.status(400).json({ success: false, message: 'At least one channel must be selected.' });
    }

    const jobId   = randomUUID();
    const adminId = req.admin?.id || 0;

    // ── Persist job row ─────────────────────────────────────────
    try {
        await pool.query(
            `INSERT INTO bulk_send_jobs (id, admin_id, status, channels, total_count)
             VALUES (?, ?, 'queued', ?, ?)`,
            [jobId, adminId, JSON.stringify(channels), contacts.length]
        );
    } catch (err) {
        console.error('[BulkSend] Failed to create job row:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to create bulk send job.' });
    }

    // ── Return 202 immediately so the UI can start polling ──────
    res.status(202).json({
        success: true,
        message: 'Bulk send job queued.',
        jobId,
        total: contacts.length,
    });

    // ── Process asynchronously (fire-and-forget) ────────────────
    setImmediate(() =>
        processBulkJob({ jobId, contacts, channels })
            .catch(err => {
                console.error('[BulkSend] Unhandled error in processBulkJob:', err.message);
                pool.query(
                    "UPDATE bulk_send_jobs SET status='failed', completed_at=NOW() WHERE id=?",
                    [jobId]
                ).catch(() => {});
            })
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications/bulk-send/:jobId  — Poll job status
// ─────────────────────────────────────────────────────────────────────────────
export const getBulkJobStatus = async (req, res) => {
    try {
        const [[job]] = await pool.query(
            `SELECT id, status, channels, total_count, sent_count, failed_count,
                    error_log, created_at, completed_at
             FROM bulk_send_jobs WHERE id = ?`,
            [req.params.jobId]
        );
        if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
        return res.json({ success: true, data: job });
    } catch (err) {
        console.error('[BulkSend:status]', err.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch job status.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/bulk-send/:jobId/cancel
// ─────────────────────────────────────────────────────────────────────────────
export const cancelBulkJob = async (req, res) => {
    try {
        const [[job]] = await pool.query(
            'SELECT id, status FROM bulk_send_jobs WHERE id = ?',
            [req.params.jobId]
        );
        if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
            return res.status(400).json({ success: false, message: 'Job cannot be cancelled in its current state.' });
        }
        await pool.query(
            "UPDATE bulk_send_jobs SET status='cancelled', completed_at=NOW() WHERE id=?",
            [req.params.jobId]
        );
        return res.json({ success: true, message: 'Job cancelled.' });
    } catch (err) {
        console.error('[BulkSend:cancel]', err.message);
        return res.status(500).json({ success: false, message: 'Failed to cancel job.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Simple promise-based sleep */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Normalise any Indian phone number to E.164 (+91XXXXXXXXXX). */
const normalisePhone = (raw) => {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    return '+91' + digits.slice(-10);
};

/**
 * sendWithRetry — calls fn(), retrying on 429/503/generic 5xx.
 *
 * On 429: reads Retry-After header (defaults to 10 s) before retrying.
 * On 503: waits 10 s before retrying.
 * On 400/401: non-retryable; throws immediately.
 * On other errors: waits 3 s before retrying.
 *
 * Returns normally on success; throws on exhausted retries.
 */
const sendWithRetry = async (fn, contactId, channel, maxRetries = 2) => {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            await fn();
            return; // success
        } catch (err) {
            lastErr = err;
            const httpStatus = err?.response?.status || err?.status || err?.statusCode;

            if (httpStatus === 429) {
                const retryAfter = parseInt(
                    err?.response?.headers?.['retry-after'] || '10',
                    10
                );
                console.warn(
                    `[BulkSend] 429 rate-limited (contact=${contactId}, ch=${channel}). ` +
                    `Waiting ${retryAfter}s (retry ${attempt + 1}/${maxRetries})…`
                );
                await sleep(retryAfter * 1000);
                continue;
            }

            // 503 — brief service unavailability
            if (httpStatus === 503) {
                console.warn(`[BulkSend] 503 for contact=${contactId}, ch=${channel}. Waiting 10s…`);
                await sleep(10_000);
                continue;
            }

            // 400/401 — non-retryable (bad number, bad API key, etc.)
            if (httpStatus === 400 || httpStatus === 401) break;

            // Other errors — brief back-off
            if (attempt < maxRetries) await sleep(3_000);
        }
    }
    throw lastErr;
};

// ─────────────────────────────────────────────────────────────────────────────
// logCommunication helper — writes to centralized polymorphic table
// ─────────────────────────────────────────────────────────────────────────────
const logCommunication = async (modulePrefix, entityId, channel, recipient, message) => {
    try {
        if (!modulePrefix || !entityId) return; // Cannot log without association

        const moduleLabels = {
            'C-': 'Complaint',
            'P-': 'Issue',
            'I-': 'Idea',
            'S-': 'Suggestion',
            'F-': 'Application' // CM Fund Request
        };
        const entityType = moduleLabels[modulePrefix];
        if (!entityType) return; // Unknown module type

        await pool.query(
            `INSERT INTO communications_logs (entity_type, entity_id, channel, recipient, message) 
             VALUES (?, ?, ?, ?, ?)`,
            [entityType, entityId, channel, recipient, message]
        );
    } catch (err) {
        console.error(`[logCommunication] Error logging ${channel} to ${entityType} ${entityId}:`, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// processBulkJob — core background processor
//
// Adaptive batching:
//   • Starts at INITIAL_BATCH_SIZE contacts processed concurrently per batch
//   • Waits INITIAL_DELAY_MS between batches
//   • On any 429 in a batch → halve batchSize, double delay (capped)
//   • After RECOVER_AFTER_CLEAN consecutive clean batches → recover size/delay
// ─────────────────────────────────────────────────────────────────────────────
const processBulkJob = async ({ jobId, contacts, channels, messages, subject }) => {
    const INITIAL_BATCH_SIZE  = 10;
    const INITIAL_DELAY_MS    = 2_000;
    const MIN_BATCH_SIZE      = 1;
    const MAX_BATCH_SIZE      = 10;
    const MIN_DELAY_MS        = 2_000;
    const MAX_DELAY_MS        = 30_000;
    const RECOVER_AFTER_CLEAN = 5;

    let batchSize    = INITIAL_BATCH_SIZE;
    let batchDelayMs = INITIAL_DELAY_MS;
    let cleanStreak  = 0;
    let sentCount    = 0;
    let failedCount  = 0;
    const errorLog   = [];

    // Mark running
    await pool.query("UPDATE bulk_send_jobs SET status='running' WHERE id=?", [jobId]);

    let batchStart = 0;
    while (batchStart < contacts.length) {
        // Check for cancellation between batches
        const [[jobRow]] = await pool.query(
            'SELECT status FROM bulk_send_jobs WHERE id=?',
            [jobId]
        );
        if (!jobRow || jobRow.status === 'cancelled') {
            console.log(`[BulkSend:${jobId}] Cancelled — stopping.`);
            return;
        }

        const batch = contacts.slice(batchStart, batchStart + batchSize);
        let batchHad429 = false;

        await Promise.all(batch.map(async (contact) => {
            let contactSentAny = false;

            // ── Official Template Generation ──────────────────────────
            const moduleLabels = {
                'C-': 'Complaint',
                'P-': 'Public Issue',
                'I-': 'Idea',
                'S-': 'Suggestion',
                'F-': 'CM Fund Request'
            };
            const label = moduleLabels[contact.module] || 'Application';
            
            const templateData = {
                name: contact.name || 'Citizen',
                referenceNo: contact.trackingId || '—',
                statusTitle: contact.statusText || 'We are reviewing your submission.',
                moduleLabel: label,
                updateDate: new Date()
            };

            const pSms      = channels.sms      ? followUpUpdateSMS(templateData)      : '';
            const pWhatsapp = channels.whatsapp ? followUpUpdateWhatsApp(templateData) : '';
            const emailObj  = channels.email    ? followUpUpdateEmail(templateData)    : null;

            // ── SMS ──────────────────────────────────────────────
            if (channels.sms && contact.phone) {
                try {
                    const phone = normalisePhone(contact.phone);
                    await sendWithRetry(
                        () => sendSMS(phone, pSms),
                        contact.id, 'sms'
                    );
                    contactSentAny = true;
                    await logCommunication(contact.module, contact.id, 'SMS', phone, pSms);
                } catch (err) {
                    const status = err?.response?.status || err?.status || err?.statusCode;
                    if (status === 429) batchHad429 = true;
                    errorLog.push({ contactId: contact.id, channel: 'sms', error: err.message });
                    console.error(`[BulkSend] SMS ❌ contact=${contact.id}:`, err.message);
                }
            }

            // ── Email ────────────────────────────────────────────
            if (channels.email && contact.email && emailObj) {
                try {
                    await sendWithRetry(
                        () => sendNotificationEmail({
                            to:      contact.email,
                            subject: emailObj.subject,
                            message: emailObj.body,
                        }),
                        contact.id, 'email'
                    );
                    contactSentAny = true;
                    await logCommunication(contact.module, contact.id, 'Email', contact.email, emailObj.body);
                } catch (err) {
                    const status = err?.response?.status || err?.status || err?.statusCode;
                    if (status === 429) batchHad429 = true;
                    errorLog.push({ contactId: contact.id, channel: 'email', error: err.message });
                    console.error(`[BulkSend] Email ❌ contact=${contact.id}:`, err.message);
                }
            }

            // ── WhatsApp ─────────────────────────────────────────
            if (channels.whatsapp && contact.phone) {
                try {
                    const raw    = String(contact.phone).replace(/\D/g, '');
                    const waPhone = raw.length === 10 ? `91${raw}` : (raw.startsWith('91') ? raw : raw);
                    await sendWithRetry(
                        () => sendWhatsAppMessage(waPhone, pWhatsapp),
                        contact.id, 'whatsapp'
                    );
                    contactSentAny = true;
                    await logCommunication(contact.module, contact.id, 'WhatsApp', waPhone, pWhatsapp);
                } catch (err) {
                    const status = err?.response?.status || err?.status || err?.statusCode;
                    if (status === 429) batchHad429 = true;
                    errorLog.push({ contactId: contact.id, channel: 'whatsapp', error: err.message });
                    console.error(`[BulkSend] WhatsApp ❌ contact=${contact.id}:`, err.message);
                }
            }

            // Count at contact level: sent if at least one channel succeeded
            if (contactSentAny) { sentCount++; } else { failedCount++; }
        }));

        // Persist progress after every batch
        await pool.query(
            'UPDATE bulk_send_jobs SET sent_count=?, failed_count=?, error_log=? WHERE id=?',
            [sentCount, failedCount, JSON.stringify(errorLog), jobId]
        );

        // Adaptive rate control
        if (batchHad429) {
            cleanStreak  = 0;
            batchSize    = Math.max(MIN_BATCH_SIZE, Math.floor(batchSize / 2));
            batchDelayMs = Math.min(MAX_DELAY_MS, batchDelayMs * 2);
            console.warn(
                `[BulkSend:${jobId}] Rate-limit → batchSize=${batchSize}, delay=${batchDelayMs}ms`
            );
        } else {
            cleanStreak++;
            if (cleanStreak >= RECOVER_AFTER_CLEAN) {
                cleanStreak  = 0;
                batchSize    = Math.min(MAX_BATCH_SIZE, batchSize + 1);
                batchDelayMs = Math.max(MIN_DELAY_MS, batchDelayMs - 500);
            }
        }

        batchStart += batch.length; // advance by actual batch processed (may < batchSize)

        // Wait between batches (skip after last batch)
        if (batchStart < contacts.length) await sleep(batchDelayMs);
    }

    // Finalise
    const finalStatus = failedCount === 0 ? 'completed'
                      : sentCount  === 0 ? 'failed'
                      : 'partial_failure';

    await pool.query(
        `UPDATE bulk_send_jobs
         SET status=?, sent_count=?, failed_count=?, error_log=?, completed_at=NOW()
         WHERE id=?`,
        [finalStatus, sentCount, failedCount, JSON.stringify(errorLog), jobId]
    );

    console.log(
        `[BulkSend:${jobId}] ✅ ${finalStatus} — sent=${sentCount}, failed=${failedCount}`
    );
};
