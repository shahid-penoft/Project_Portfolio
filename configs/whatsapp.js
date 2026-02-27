import 'dotenv/config';
import axios from 'axios';

/**
 * WhatsApp Business API Service Configuration
 * Uses official WhatsApp Business API (Cloud API) for sending messages
 */

const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BA_ID;
const WHATSAPP_API_URL = `https://graph.instagram.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;

if (!WHATSAPP_API_KEY || !WHATSAPP_PHONE_ID) {
    console.warn('⚠️  WhatsApp API keys not configured. WhatsApp service will not work.');
}

/**
 * Send WhatsApp Message via Official API
 * @param {string} phoneNumber - Recipient phone number (with country code, e.g., 91XXXXXXXXXX)
 * @param {string} message - Message content
 * @returns {Promise<Object>} Response from WhatsApp API
 */
export const sendWhatsAppMessage = async (phoneNumber, message) => {
    if (!WHATSAPP_API_KEY || !WHATSAPP_PHONE_ID) {
        throw new Error('WhatsApp API credentials are not configured.');
    }

    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'text',
                text: {
                    preview_url: false,
                    body: message,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log(`✅ WhatsApp message sent to ${phoneNumber}`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ WhatsApp API Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || 'Failed to send WhatsApp message');
    }
};

/**
 * Send WhatsApp Template Message
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} templateName - Template name
 * @param {Array} parameters - Template parameters/placeholders
 * @returns {Promise<Object>} Response from WhatsApp API
 */
export const sendWhatsAppTemplate = async (phoneNumber, templateName, parameters = []) => {
    if (!WHATSAPP_API_KEY || !WHATSAPP_PHONE_ID) {
        throw new Error('WhatsApp API credentials are not configured.');
    }

    try {
        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: 'en_US',
                    },
                    ...(parameters.length > 0 && {
                        components: [
                            {
                                type: 'body',
                                parameters: parameters.map(p => ({ type: 'text', text: p })),
                            },
                        ],
                    }),
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${WHATSAPP_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log(`✅ WhatsApp template sent to ${phoneNumber}`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ WhatsApp Template Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || 'Failed to send WhatsApp template');
    }
};

export default { sendWhatsAppMessage, sendWhatsAppTemplate };
