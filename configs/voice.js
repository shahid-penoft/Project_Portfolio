import 'dotenv/config';
import axios from 'axios';

/**
 * Voice Messaging Service Configuration
 * Supports voice calls/voice messages via third-party APIs
 * Currently configured for text-to-speech voice message delivery
 */

const VOICE_API_PROVIDER = process.env.VOICE_API_PROVIDER || 'brevo'; // 'brevo', 'twilio', or custom
const VOICE_API_KEY = process.env.VOICE_API_KEY;
const VOICE_PHONE_ID = process.env.VOICE_PHONE_ID;

if (!VOICE_API_KEY) {
    console.warn('⚠️  VOICE_API_KEY not configured. Voice messaging service will not work.');
}

/**
 * Send Voice Message (Pre-recorded or TTS)
 * @param {string} phoneNumber - Recipient phone number (with country code)
 * @param {string} message - Message content (will be converted to speech if TTS is enabled)
 * @param {Object} options - Additional options { prerecordedUrl, language, etc }
 * @returns {Promise<Object>} Response from voice API
 */
export const sendVoiceMessage = async (phoneNumber, message, options = {}) => {
    if (!VOICE_API_KEY) {
        throw new Error('Voice API key is not configured.');
    }

    if (VOICE_API_PROVIDER === 'brevo') {
        return sendBrevoVoiceMessage(phoneNumber, message, options);
    } else {
        throw new Error(`Voice provider "${VOICE_API_PROVIDER}" is not supported.`);
    }
};

/**
 * Send Voice Message via Brevo (if available)
 * Note: Brevo SMS API can be extended for voice messages
 */
const sendBrevoVoiceMessage = async (phoneNumber, message, options = {}) => {
    try {
        // Brevo voice messaging API endpoint (if available)
        const voiceUrl = 'https://api.brevo.com/v3/voiceMessages/send';

        const response = await axios.post(
            voiceUrl,
            {
                sender: options.senderName || 'AdminCall',
                to: phoneNumber,
                content: message,
                language: options.language || 'en-US',
                type: options.type || 'transactional', // transactional, promotional
                ...(options.prerecordedUrl && { audioUrl: options.prerecordedUrl }),
            },
            {
                headers: {
                    'api-key': VOICE_API_KEY,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log(`✅ Voice message sent to ${phoneNumber}`);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('❌ Brevo Voice Message Error:', error.response?.data || error.message);
        // Fallback: If voice API not available, log the attempt
        if (error.response?.status === 404) {
            console.warn('⚠️  Voice messaging not available. Can be configured with Twilio or similar service.');
            return {
                success: false,
                error: 'Voice messaging service not currently available. Please use SMS or WhatsApp instead.',
            };
        }
        throw new Error(error.response?.data?.message || 'Failed to send voice message');
    }
};

export default { sendVoiceMessage };
