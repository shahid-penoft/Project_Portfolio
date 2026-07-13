import { BrevoClient } from '@getbrevo/brevo';

// ─── Brevo v4 SDK — use BrevoClient (new API in @getbrevo/brevo v4) ──────────
// The old TransactionalSMSApi class no longer exists in v4.
// Authentication is done by passing apiKey directly to the client constructor.
let brevoClient = null;

const getClient = () => {
    if (!brevoClient) {
        brevoClient = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
    }
    return brevoClient;
};

/**
 * Normalize a phone number to E.164 format required by Brevo.
 *
 * Rules (Indian numbers):
 *  - 10-digit number          → +91XXXXXXXXXX
 *  - 12-digit starting 91...  → +91XXXXXXXXXX
 *  - Already has leading +    → kept as-is
 */
const normalizePhone = (phone) => {
    const cleaned = (phone || '').replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return `+${cleaned}`; // assume digits already carry country code
};

/**
 * Send a transactional SMS via Brevo.
 *
 * @param {string} to      - Recipient phone number (any format, auto-normalized to E.164)
 * @param {string} content - SMS body text (keep under 160 chars for a single-part SMS)
 * @returns {Promise}      - Resolves with the Brevo API response
 */
export const sendSMS = async (to, content) => {
    const client = getClient();

    const payload = {
        sender: process.env.BREVO_SMS_SENDER || 'MLAConnect',
        recipient: normalizePhone(to),
        content,
        type: 'transactional',
    };

    return client.transactionalSms.sendTransacSms(payload);
};

/**
 * Fire-and-forget SMS wrapper — errors are logged but never re-thrown.
 * Use this in controllers so an SMS failure never blocks the API response.
 *
 * @param {string} to      - Recipient phone number
 * @param {string} content - SMS body text
 */
export const sendSMSSafe = async (to, content) => {
    try {
        if (!to) return;
        await sendSMS(to, content);
        console.info('[SMS sent]', to);
    } catch (err) {
        console.warn('[SMS failed — non-fatal]', to, err.message);
    }
};
