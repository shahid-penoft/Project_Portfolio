import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { sendEnquiryReceivedEmail, sendAdminEnquiryAlert } from '../utils/email.js';
import { sendBrevoSMS } from '../configs/sms.js';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from '../configs/whatsapp.js';
import { sendVoiceMessage } from '../configs/voice.js';

const CATEGORIES = ['membership', 'local issues', 'submit ideas', 'submit opinions', 'general'];

// ─────────────────────────────────────────────────────────────
//  POST /api/contact  — Public (no auth required)
// ─────────────────────────────────────────────────────────────
export const submitContact = async (req, res) => {
    const { full_name, mobile, email, panchayat_id, category, subject, message } = req.body;

    if (!full_name?.trim() || !mobile?.trim() || !email?.trim() || !message?.trim()) {
        return errorResponse(res, 'full_name, mobile, email and message are required.', 400);
    }
    if (category && !CATEGORIES.includes(category.toLowerCase())) {
        return errorResponse(res, `Invalid category. Must be one of: ${CATEGORIES.join(', ')}.`, 400);
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO contact_enquiries
             (full_name, mobile, email, panchayat_id, category, subject, message)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                full_name.trim(),
                mobile.trim(),
                email.trim(),
                panchayat_id || null,
                category?.toLowerCase() || 'general',
                subject?.trim() || null,
                message.trim(),
            ]
        );

        // Fetch panchayat name for use in emails
        let panchayatName = 'N/A';
        if (panchayat_id) {
            const [[lb]] = await pool.query('SELECT name FROM local_bodies WHERE id = ?', [panchayat_id]);
            if (lb) panchayatName = lb.name;
        }

        const enquiry = {
            id: result.insertId,
            full_name: full_name.trim(),
            mobile: mobile.trim(),
            email: email.trim(),
            panchayat: panchayatName,
            category: category || 'general',
            subject: subject?.trim() || 'N/A',
            message: message.trim(),
        };

        // Send both emails concurrently — don't block the response on failure
        Promise.all([
            sendEnquiryReceivedEmail(enquiry).catch(e => console.error('[Email:UserConfirm]', e)),
            sendAdminEnquiryAlert(enquiry).catch(e => console.error('[Email:AdminAlert]', e)),
        ]);

        return successResponse(res, { id: result.insertId }, 'Your enquiry has been submitted successfully.', 201);
    } catch (err) {
        console.error('[submitContact]', err);
        return errorResponse(res, 'Failed to submit enquiry.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/contact  — Admin: paginated list with filters
// ─────────────────────────────────────────────────────────────
export const getEnquiries = async (req, res) => {
    const { search, category, status, panchayat_id } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);
    const offset = (page - 1) * limit;

    try {
        let where = 'WHERE 1=1';
        const params = [];

        if (search) {
            const like = `%${search}%`;
            where += ' AND (c.full_name LIKE ? OR c.email LIKE ? OR c.subject LIKE ? OR c.message LIKE ?)';
            params.push(like, like, like, like);
        }
        if (category) {
            where += ' AND c.category = ?';
            params.push(category.toLowerCase());
        }
        if (status) {
            where += ' AND c.status = ?';
            params.push(status);
        }
        if (panchayat_id) {
            where += ' AND c.panchayat_id = ?';
            params.push(panchayat_id);
        }

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM contact_enquiries c ${where}`, params
        );

        const [rows] = await pool.query(
            `SELECT c.*, lb.name AS panchayat_name
             FROM contact_enquiries c
             LEFT JOIN local_bodies lb ON lb.id = c.panchayat_id
             ${where}
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Enquiries fetched.');
    } catch (err) {
        console.error('[getEnquiries]', err);
        return errorResponse(res, 'Failed to fetch enquiries.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/contact/:id  — Admin
// ─────────────────────────────────────────────────────────────
export const getEnquiryById = async (req, res) => {
    try {
        const [[row]] = await pool.query(
            `SELECT c.*, lb.name AS panchayat_name
             FROM contact_enquiries c
             LEFT JOIN local_bodies lb ON lb.id = c.panchayat_id
             WHERE c.id = ?`,
            [req.params.id]
        );
        if (!row) return errorResponse(res, 'Enquiry not found.', 404);
        return successResponse(res, row, 'Enquiry fetched.');
    } catch (err) {
        console.error('[getEnquiryById]', err);
        return errorResponse(res, 'Failed to fetch enquiry.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/contact/:id/status  — Admin: mark read/resolved
// ─────────────────────────────────────────────────────────────
export const updateEnquiryStatus = async (req, res) => {
    const { status } = req.body;
    const VALID = ['new', 'read', 'resolved'];
    if (!VALID.includes(status)) {
        return errorResponse(res, `status must be one of: ${VALID.join(', ')}.`, 400);
    }
    try {
        const [r] = await pool.query(
            'UPDATE contact_enquiries SET status = ? WHERE id = ?',
            [status, req.params.id]
        );
        if (r.affectedRows === 0) return errorResponse(res, 'Enquiry not found.', 404);
        return successResponse(res, null, `Enquiry marked as ${status}.`);
    } catch (err) {
        console.error('[updateEnquiryStatus]', err);
        return errorResponse(res, 'Failed to update status.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/contact/:id  — Admin
// ─────────────────────────────────────────────────────────────
export const deleteEnquiry = async (req, res) => {
    try {
        const [r] = await pool.query('DELETE FROM contact_enquiries WHERE id = ?', [req.params.id]);
        if (r.affectedRows === 0) return errorResponse(res, 'Enquiry not found.', 404);
        return successResponse(res, null, 'Enquiry deleted.');
    } catch (err) {
        console.error('[deleteEnquiry]', err);
        return errorResponse(res, 'Failed to delete enquiry.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/contact/:id/send-sms  — Admin: Send SMS via Brevo
// ─────────────────────────────────────────────────────────────
export const sendSMS = async (req, res) => {
    const { message } = req.body;
    const enquiryId = req.params.id;

    if (!message?.trim()) {
        return errorResponse(res, 'Message content is required.', 400);
    }

    try {
        // Fetch enquiry and phone number
        const [[enquiry]] = await pool.query('SELECT mobile FROM contact_enquiries WHERE id = ?', [enquiryId]);
        if (!enquiry) return errorResponse(res, 'Enquiry not found.', 404);

        // Ensure phone number has country code (default to India +91)
        let phone = enquiry.mobile.trim();
        if (!phone.startsWith('+')) {
            phone = phone.startsWith('0') ? '+91' + phone.substring(1) : '+91' + phone;
        }

        // Send SMS via Brevo
        const result = await sendBrevoSMS(phone, message.trim());

        // Log communication
        await pool.query(
            `INSERT INTO enquiry_communications (enquiry_id, type, recipient, message, status) 
             VALUES (?, ?, ?, ?, ?)`,
            [enquiryId, 'sms', phone, message.trim(), 'sent']
        ).catch(e => console.error('[Log SMS]', e));

        return successResponse(res, result.data, 'SMS sent successfully.');
    } catch (err) {
        console.error('[sendSMS]', err);
        return errorResponse(res, err.message || 'Failed to send SMS.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/contact/:id/send-whatsapp  — Admin: Send WhatsApp msg
// ─────────────────────────────────────────────────────────────
export const sendWhatsApp = async (req, res) => {
    const { message } = req.body;
    const enquiryId = req.params.id;

    if (!message?.trim()) {
        return errorResponse(res, 'Message content is required.', 400);
    }

    try {
        // Fetch enquiry and phone number
        const [[enquiry]] = await pool.query('SELECT mobile FROM contact_enquiries WHERE id = ?', [enquiryId]);
        if (!enquiry) return errorResponse(res, 'Enquiry not found.', 404);

        // Format phone number for WhatsApp (no + prefix for API)
        let phone = enquiry.mobile.trim();
        if (phone.startsWith('+')) phone = phone.substring(1);
        if (phone.startsWith('0')) phone = '91' + phone.substring(1);
        if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone;

        // Send WhatsApp message
        const result = await sendWhatsAppMessage(phone, message.trim());

        // Log communication
        await pool.query(
            `INSERT INTO enquiry_communications (enquiry_id, type, recipient, message, status) 
             VALUES (?, ?, ?, ?, ?)`,
            [enquiryId, 'whatsapp', phone, message.trim(), 'sent']
        ).catch(e => console.error('[Log WhatsApp]', e));

        return successResponse(res, result.data, 'WhatsApp message sent successfully.');
    } catch (err) {
        console.error('[sendWhatsApp]', err);
        return errorResponse(res, err.message || 'Failed to send WhatsApp message.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/contact/:id/send-voice  — Admin: Send Voice Message
// ─────────────────────────────────────────────────────────────
export const sendVoice = async (req, res) => {
    const { message } = req.body;
    const enquiryId = req.params.id;

    if (!message?.trim()) {
        return errorResponse(res, 'Message content is required.', 400);
    }

    try {
        // Fetch enquiry and phone number
        const [[enquiry]] = await pool.query('SELECT mobile FROM contact_enquiries WHERE id = ?', [enquiryId]);
        if (!enquiry) return errorResponse(res, 'Enquiry not found.', 404);

        // Format phone number
        let phone = enquiry.mobile.trim();
        if (!phone.startsWith('+')) {
            phone = phone.startsWith('0') ? '+91' + phone.substring(1) : '+91' + phone;
        }

        // Send voice message
        const result = await sendVoiceMessage(phone, message.trim());

        if (result.success) {
            // Log communication
            await pool.query(
                `INSERT INTO enquiry_communications (enquiry_id, type, recipient, message, status) 
                 VALUES (?, ?, ?, ?, ?)`,
                [enquiryId, 'voice', phone, message.trim(), 'sent']
            ).catch(e => console.error('[Log Voice]', e));

            return successResponse(res, result.data, 'Voice message sent successfully.');
        } else {
            return errorResponse(res, result.error || 'Voice service not available.', 503);
        }
    } catch (err) {
        console.error('[sendVoice]', err);
        return errorResponse(res, err.message || 'Failed to send voice message.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/contact/:id/communications  — Admin: Get message logs
// ─────────────────────────────────────────────────────────────
export const getCommunications = async (req, res) => {
    const enquiryId = req.params.id;

    try {
        const [communications] = await pool.query(
            `SELECT * FROM enquiry_communications 
             WHERE enquiry_id = ? 
             ORDER BY created_at DESC`,
            [enquiryId]
        );

        return successResponse(res, communications, 'Communications fetched.');
    } catch (err) {
        console.error('[getCommunications]', err);
        // If table doesn't exist, return empty array
        return successResponse(res, [], 'Communications fetched.');
    }
};

