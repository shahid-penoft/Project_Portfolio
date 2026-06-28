import db from '../configs/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import sandboxTokenService from '../services/sandboxTokenService.js';
import crypto from 'crypto';

// --- Identity Verification ---

// Send Aadhaar OTP using Sandbox
export const sendAadhaarOtp = async (req, res) => {
    const { aadhaar } = req.body;

    if (process.env.AADHAAR_MOCK === 'true') {
        console.log("Mock Mode: Simulating Aadhaar OTP generation for", aadhaar);
        return res.json({ success: true, reference_id: 'mock_reference_12345' });
    }

    try {
        const token = await sandboxTokenService.getToken();
        const payload = {
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
            aadhaar_number: aadhaar,
            consent: "Y",
            reason: "KYC verification"
        };
        console.log("Sending to Sandbox:", payload);
        const response = await axios.post(
            'https://api.sandbox.co.in/kyc/aadhaar/okyc/otp',
            payload,
            {
                headers: {
                    'Authorization': token, // As per docs, no Bearer
                    'x-api-key': process.env.SANDBOX_API_KEY,
                    'x-api-version': '1.0.0'
                }
            }
        );
        return res.json({ success: true, reference_id: response.data.data.reference_id });
    } catch (error) {
        console.error("Sandbox Error:", error.response?.data || error.message);
        if (error.response?.status === 422 || error.response?.data?.message?.toLowerCase().includes('mobile')) {
            return res.status(422).json({
                success: false,
                error_code: 'AADHAAR_MOBILE_NOT_LINKED',
                message: 'Your Aadhaar is not linked to any mobile number.'
            });
        }
        return res.status(400).json({
            success: false,
            message: error.response?.data?.message || 'Failed to generate Aadhaar OTP'
        });
    }
};

// Confirm Aadhaar OTP
export const confirmAadhaarOtp = async (req, res) => {
    const { reference_id, otp } = req.body;

    if (process.env.AADHAAR_MOCK === 'true') {
        console.log("Mock Mode: Simulating Aadhaar OTP confirmation for", reference_id);
        if (otp === '123456') { // Simple mock validation
            return res.json({
                "success": true,
                "data": {
                    "code": 200,
                    "timestamp": 1781261904544,
                    "data": {
                        "@entity": "in.co.sandbox.kyc.aadhaar.okyc",
                        "reference_id": 78484026,
                        "status": "VALID",
                        "message": "Aadhaar Card Exists",
                        "care_of": "S/O Ummer K",
                        "full_address": "KAKKATTIL, CHERUKARA, Cherukara, Perinthalmanna, Malappuram, Elamkulam, Kerala, India, 679340",
                        "date_of_birth": "19-11-2000",
                        "email_hash": "",
                        "gender": "M",
                        "name": "Mohammed Shahid Ummer K",
                        "address": {
                            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.address",
                            "country": "India",
                            "district": "Malappuram",
                            "house": "KAKKATTIL",
                            "landmark": "",
                            "pincode": 679340,
                            "post_office": "Cherukara",
                            "state": "Kerala",
                            "street": "CHERUKARA",
                            "subdistrict": "Perinthalmanna",
                            "vtc": "Elamkulam"
                        },
                        "year_of_birth": 2000,
                        "mobile_hash": "c3b803c7c5d94e406a8e1dbe051b6346bd61c5a2ba49f068b1f7359a9236d3f4",
                        "photo": "" /* Hidden in mock mode - real photo returned by Sandbox in production */,
                        "photo_hidden": "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",
                        "share_code": "2345"
                    },
                    "transaction_id": "4fe882b8-b72c-43a7-9e19-19805fc87a0d"
                }
            });
        }
        return res.status(400).json({ success: false, message: 'Invalid Mock OTP (Hint: use 123456)' });
    }

    try {
        const token = await sandboxTokenService.getToken();
        const response = await axios.post(
            'https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify',
            {
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
                reference_id: String(reference_id),
                otp: String(otp)
            },
            {
                headers: {
                    'Authorization': token,
                    'x-api-key': process.env.SANDBOX_API_KEY,
                    'x-api-version': '1.0.0'
                }
            }
        );
        
        if (response.data?.data?.message === 'Invalid OTP') {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        return res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("Sandbox Verify Error:", error.response?.data || error.message);
        return res.status(400).json({ 
            success: false, 
            message: error.response?.data?.message || 'Invalid OTP or Verification Failed' 
        });
    }
};

// Validate Voter ID (Sandbox) + Send OTP (2Factor)
export const validateVoterId = async (req, res) => {
    const { voter_id, phone } = req.body;
    try {
        const token = await sandboxTokenService.getToken();
        
        // 1. Validate Voter ID with Sandbox
        const voterRes = await axios.post(
            'https://api.sandbox.co.in/kyc/voter/verify', // Note: Endpoint may vary depending on sandbox version, using standard voter verify path
            { epic_number: voter_id },
            {
                headers: {
                    'Authorization': token,
                    'x-api-key': process.env.SANDBOX_API_KEY,
                    'x-api-version': '1.0.0'
                }
            }
        ).catch(err => {
            // Throw so it gets caught by outer try-catch
            throw new Error('Invalid Voter ID (EPIC number).');
        });

        // If voter is valid, send OTP via 2factor
        if (process.env.DEVOTP === 'true') {
            return res.json({ success: true, session_id: 'mock_voter_session' });
        }

        const response = await axios.get(`https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${phone}/AUTOGEN`);
        
        if (response.data.Status === 'Success') {
            return res.json({ success: true, session_id: response.data.Details });
        } else {
            return res.status(400).json({ success: false, message: 'Failed to send OTP.' });
        }
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message || 'Failed to validate Voter ID.' });
    }
};

// Confirm Voter ID OTP (via 2factor)
export const confirmVoterIdOtp = async (req, res) => {
    const { session_id, otp } = req.body;
    try {
        if (process.env.DEVOTP === 'true' && otp === '12345') {
            return res.json({ success: true });
        }

        const response = await axios.get(`https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/VERIFY/${session_id}/${otp}`);
        if (response.data.Status === 'Success') {
            return res.json({ success: true });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
    } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid OTP or Verification Failed' });
    }
};

// --- Auth / Login / Register ---

// Register Constituent
export const registerConstituent = async (req, res) => {
    const { verification_method, verification_id, full_name, email, panchayat_id, ward_id, house_name, house_number, password, gender } = req.body;
    const phone = (req.body.phone || '').replace(/^91/, ''); // Normalize to 10 digits

    try {
        // Check if phone exists
        const [existing] = await db.query('SELECT id FROM constituent_users WHERE phone = ?', [phone]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Mobile number already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.query(
            `INSERT INTO constituent_users 
             (full_name, phone, email, password, verification_method, verification_id, panchayat_id, ward_id, house_name, house_number, gender) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [full_name, phone, email || null, hashedPassword, verification_method, verification_id, panchayat_id, ward_id, house_name, house_number, gender || null]
        );

        res.status(201).json({ success: true, message: 'Account created successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
};

// Send Login OTP
export const sendLoginOtp = async (req, res) => {
    const { phone } = req.body;
    try {
        // Check if user exists
        const [users] = await db.query('SELECT id FROM constituent_users WHERE phone = ?', [phone.replace(/^91/, '')]);
        if (!users.length) {
            return res.status(404).json({ success: false, message: 'Mobile number not found. Please register first.' });
        }

        if (process.env.DEVOTP === 'true') {
            return res.json({ success: true, session_id: 'mock_login_session' });
        }

        const response = await axios.get(`https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${phone}/AUTOGEN`);
        if (response.data.Status === 'Success') {
            return res.json({ success: true, session_id: response.data.Details });
        } else {
            return res.status(400).json({ success: false, message: 'Failed to send OTP.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error while sending OTP.' });
    }
};

// Verify Login OTP
export const verifyLoginOtp = async (req, res) => {
    const { phone, otp, session_id, rememberMe } = req.body;
    try {
        let isSuccess = false;

        if (process.env.DEVOTP === 'true' && otp === '12345') {
            isSuccess = true;
        } else {
            const response = await axios.get(`https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/VERIFY/${session_id}/${otp}`);
            isSuccess = response.data.Status === 'Success';
        }
        
        if (isSuccess) {
            // Find user
            const rawPhone = phone.replace(/^91/, '');
            const [users] = await db.query('SELECT id, full_name, phone, email, is_active FROM constituent_users WHERE phone = ?', [rawPhone]);
            
            if (!users.length) {
                return res.status(404).json({ success: false, message: 'User not found.' });
            }
            
            const user = users[0];
            if (!user.is_active) {
                return res.status(403).json({ success: false, message: 'Account is deactivated.' });
            }

            // Update last login
            await db.query('UPDATE constituent_users SET last_login = NOW() WHERE id = ?', [user.id]);

            // Generate JWT
            const expiresIn = rememberMe ? process.env.JWT_EXPIRES_IN || '7d' : '24h';
            const token = jwt.sign(
                { id: user.id },
                process.env.CONSTITUENT_JWT_SECRET,
                { expiresIn }
            );

            // Set cookie
            const isProd = process.env.NODE_ENV === 'production';
            res.cookie('constituent_token', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax',
                maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined,
                path: '/'
            });

            return res.json({ success: true, data: user });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }
    } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid OTP or verification failed.' });
    }
};

// Get Session User
export const getConstituentProfile = (req, res) => {
    res.json({ success: true, data: req.constituent });
};

// Logout
export const constituentLogout = (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('constituent_token', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/'
    });
    res.json({ success: true, message: 'Logged out successfully.' });
};

// Forgot Password (Email-based)
export const constituentForgotPassword = async (req, res) => {
    // Basic stub for email based forgot password if needed later
    return res.status(501).json({ success: false, message: 'Not implemented.' });
};

// Reset Password
export const constituentResetPassword = async (req, res) => {
    return res.status(501).json({ success: false, message: 'Not implemented.' });
};
