import { sendSMS } from '../services/smsService.js';
import { sendNotificationEmail } from '../utils/email.js';
import { sendWhatsAppMessage } from '../configs/whatsapp.js';

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
