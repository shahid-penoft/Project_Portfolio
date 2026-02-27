import 'dotenv/config';
import axios from 'axios';

/**
 * Brevo SMS Service Configuration
 * Uses Brevo's Transactional SMS API for sending SMS messages
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER = process.env.BREVO_SMS_SENDER || 'MessageSend';
const BREVO_SMS_API = 'https://api.brevo.com/v3/sms/send';

if (!BREVO_API_KEY) {
    console.warn('⚠️  BREVO_API_KEY not configured. SMS service will not work.');
}

/**
 * Send SMS via Brevo
 * @param {string} phoneNumber - Recipient phone number (with country code, e.g., +91XXXXXXXXXX)
 * @param {string} message - SMS content
 * @returns {Promise<Object>} Response from Brevo API
 */
export const sendBrevoSMS = async (phoneNumber, message) => {
    if (!BREVO_API_KEY) {
        throw new Error('Brevo API key is not configured.');
    }

    try {
        const response = await axios.post(
            BREVO_SMS_API,
            {
                sender: BREVO_SENDER,
                to: phoneNumber,
                content: message,
                type: 'transactional',
            },
            {
                headers: {
                    'api-key': BREVO_API_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log(`✅ SMS sent to ${phoneNumber}`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ Brevo SMS Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to send SMS via Brevo');
    }
};

export default { sendBrevoSMS };
