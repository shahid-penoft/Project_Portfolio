import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

class SandboxTokenService {
    constructor() {
        this.token = null;
        this.expiresAt = null;
    }

    async getToken() {
        // Return existing token if valid (with 5 min buffer)
        if (this.token && this.expiresAt && Date.now() < this.expiresAt - 5 * 60 * 1000) {
            return this.token;
        }

        try {
            const response = await axios.post(
                'https://api.sandbox.co.in/authenticate',
                {},
                {
                    headers: {
                        'x-api-key': process.env.SANDBOX_API_KEY,
                        'x-api-secret': process.env.SANDBOX_API_SECRET,
                        'x-api-version': '1.0.0',
                        'Content-Type': 'application/json'
                    }
                }
            );

            this.token = response.data.access_token;
            // Token is valid for 24 hours. We store expiry time.
            this.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
            return this.token;
        } catch (error) {
            console.error('Error generating Sandbox Access Token:', error.response?.data || error.message);
            throw new Error('Failed to generate Sandbox access token');
        }
    }
}

export default new SandboxTokenService();
