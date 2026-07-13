import { sendSMS } from '../services/smsService.js';

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
