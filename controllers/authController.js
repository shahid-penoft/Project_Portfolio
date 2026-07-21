import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../configs/db.js';
import { sendPasswordResetEmail, sendWelcomeEmail, sendAdminChangePasswordOtpEmail, sendForgotPasswordOtpEmail } from '../utils/email.js';
import { sendAdminPasswordResetSMS, sendAdminForgotPasswordOtpSMS } from '../services/smsService.js';
import { generateToken, minutesFromNow, successResponse, errorResponse, createShortLink } from '../utils/helpers.js';
import { logActivity as auditLog } from './teamsLogController.js';

// ─────────────────────────────────────────────────────────────
//  Helper: sign JWT
// ─────────────────────────────────────────────────────────────
const signToken = (id, role) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/register
//  Authenticated admins only — creates a new admin account
// ─────────────────────────────────────────────────────────────
export const register = async (req, res) => {
    try {
        const { full_name, email, password, role = 'admin' } = req.body;

        if (!full_name || !email || !password)
            return errorResponse(res, 'full_name, email, and password are required.', 400);

        const validRoles = ['superadmin', 'admin', 'editor'];
        if (!validRoles.includes(role))
            return errorResponse(res, `Role must be one of: ${validRoles.join(', ')}`, 400);

        const [existing] = await db.query('SELECT id FROM admin_users WHERE email = ?', [email]);
        if (existing.length)
            return errorResponse(res, 'An account with this email already exists.', 409);

        const hashed = await bcrypt.hash(password, 12);
        const [result] = await db.query(
            'INSERT INTO admin_users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
            [full_name, email, hashed, role]
        );

        // Send welcome email (non-blocking)
        sendWelcomeEmail({ to: email, name: full_name, tempPassword: password }).catch(() => { });

        return successResponse(
            res,
            { data: { id: result.insertId, full_name, email, role } },
            'Admin account created successfully.',
            201
        );
    } catch (err) {
        console.error('[register]', err);
        return errorResponse(res, 'Server error during registration.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password)
            return errorResponse(res, 'Email/Mobile Number and password are required.', 400);

        const [rows] = await db.query(
            `SELECT u.*, r.name as role, r.permissions, r.is_system 
             FROM admin_users u 
             LEFT JOIN admin_roles r ON u.role_id = r.id 
             WHERE u.email = ? OR u.phone = ?`,
            [identifier, identifier]
        );
        if (!rows.length)
            return errorResponse(res, 'Invalid credentials.', 401);

        const admin = rows[0];

        if (!admin.is_active)
            return errorResponse(res, 'Your account has been deactivated. Contact super admin.', 403);

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch)
            return errorResponse(res, 'Invalid email or password.', 401);

        // Update last_login
        await db.query('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [admin.id]);

        const token = signToken(admin.id, admin.role);

        // HTTP-only cookie — JS cannot access this token via document.cookie
        res.cookie('admin_token', token, {
            httpOnly: true,                                     // blocks JS access
            secure: process.env.NODE_ENV === 'production',   // HTTPS only in prod
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',                                 // CSRF protection
            maxAge: 7 * 24 * 60 * 60 * 1000,                // 7 days
            path: '/',
        });

        const { password: _, ...adminData } = admin;
        // Patch req.admin so auditLog can read admin id
        req.admin = { id: admin.id, full_name: admin.full_name };
        auditLog(req, { action: 'Logged In', module: 'Authentication', details: `Admin login successful — ${admin.full_name} (${admin.email})`, resource: 'auth/login', severity: 'neutral' });
        // Token is NOT returned in body — it lives only in the HTTP-only cookie
        return successResponse(res, { data: adminData }, 'Login successful.');
    } catch (err) {
        console.error('[login]', err);
        return errorResponse(res, 'Server error during login.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
    try {
        const { identifier } = req.body;
        if (!identifier) return errorResponse(res, 'Email or Mobile Number is required.', 400);

        const [rows] = await db.query(
            'SELECT id, full_name, email, phone FROM admin_users WHERE (email = ? OR phone = ?) AND is_active = 1',
            [identifier, identifier]
        );

        // Always return the same message (prevents enumeration)
        if (!rows.length)
            return successResponse(res, {}, 'If that account exists, an OTP has been sent.');

        const admin = rows[0];
        // Generate a 6-digit OTP instead of a token
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Invalidate previous tokens for this identifier
        await db.query('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0', [identifier]);

        // Insert new OTP (expires in 10 minutes)
        await db.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 10 MINUTE)',
            [identifier, otp]
        );

        // Send Email OR SMS based on what they provided as identifier
        if (admin.email && admin.email === identifier) {
            await sendForgotPasswordOtpEmail({ to: admin.email, name: admin.full_name, otp });
        } else {
            await sendAdminForgotPasswordOtpSMS({ to: admin.phone || identifier, name: admin.full_name, otp });
        }

        return successResponse(res, {}, 'If that account exists, an OTP has been sent.');
    } catch (err) {
        console.error('[forgotPassword]', err);
        return errorResponse(res, 'Server error. Please try again later.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/forgot-password/verify-otp
// ─────────────────────────────────────────────────────────────
export const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const { identifier, otp } = req.body;
        if (!identifier || !otp)
            return errorResponse(res, 'Identifier and OTP are required.', 400);

        const [rows] = await db.query(
            'SELECT * FROM password_resets WHERE email = ? AND token = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()',
            [identifier, otp]
        );

        if (!rows.length) {
            return errorResponse(res, 'Invalid or expired OTP.', 400);
        }

        const resetRecord = rows[0];
        
        // Mark OTP as used
        await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [resetRecord.id]);

        // Generate a 32-byte reset token for the final step
        const temp_token = generateToken();
        await db.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 15 MINUTE)',
            [identifier, temp_token]
        );

        return successResponse(res, { reset_token: temp_token }, 'OTP verified successfully.');
    } catch (err) {
        console.error('[verifyForgotPasswordOtp]', err);
        return errorResponse(res, 'Server error verifying OTP.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
    try {
        const { token, new_password } = req.body;
        if (!token || !new_password)
            return errorResponse(res, 'Token and new_password are required.', 400);

        if (new_password.length < 8)
            return errorResponse(res, 'Password must be at least 8 characters.', 400);

        const [rows] = await db.query(
            'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()',
            [token]
        );

        if (!rows.length)
            return errorResponse(res, 'Invalid or expired reset token.', 400);

        const resetRecord = rows[0];
        const hashed = await bcrypt.hash(new_password, 12);

        await db.query('UPDATE admin_users SET password = ? WHERE email = ? OR phone = ?', [hashed, resetRecord.email, resetRecord.email]);
        await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [resetRecord.id]);

        return successResponse(res, {}, 'Password has been reset successfully.');
    } catch (err) {
        console.error('[resetPassword]', err);
        return errorResponse(res, 'Server error during password reset.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/change-password   (Authenticated)
// ─────────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password)
            return errorResponse(res, 'current_password and new_password are required.', 400);

        if (new_password.length < 8)
            return errorResponse(res, 'New password must be at least 8 characters.', 400);

        const [rows] = await db.query('SELECT * FROM admin_users WHERE id = ?', [req.admin.id]);
        const admin = rows[0];

        const isMatch = await bcrypt.compare(current_password, admin.password);
        if (!isMatch)
            return errorResponse(res, 'Current password is incorrect.', 401);

        const hashed = await bcrypt.hash(new_password, 12);
        await db.query('UPDATE admin_users SET password = ? WHERE id = ?', [hashed, admin.id]);

        return successResponse(res, {}, 'Password changed successfully.');
    } catch (err) {
        console.error('[changePassword]', err);
        return errorResponse(res, 'Server error while changing password.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/logout   (Authenticated)
// ─────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
    auditLog(req, { action: 'Logged Out', module: 'Authentication', details: `Admin logout — ${req.admin?.full_name ?? 'Unknown'}`, resource: 'auth/logout', severity: 'neutral' });
    res.clearCookie('admin_token', { path: '/' });
    return successResponse(res, {}, 'Logged out successfully.');
};

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/profile   (Authenticated)
// ─────────────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT u.id, u.full_name, u.email, u.phone, u.department, r.name as role, r.permissions, u.profile_image, u.last_login, u.created_at 
             FROM admin_users u 
             LEFT JOIN admin_roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [req.admin.id]
        );
        
        // Parse permissions if string
        if (rows[0] && typeof rows[0].permissions === 'string') {
            try {
                rows[0].permissions = JSON.parse(rows[0].permissions);
            } catch (e) {
                rows[0].permissions = [];
            }
        }
        
        return successResponse(res, { data: rows[0] }, 'Profile fetched successfully.');
    } catch (err) {
        console.error('[getProfile]', err);
        return errorResponse(res, 'Server error fetching profile.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/auth/profile   (Authenticated)
// ─────────────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
    try {
        const { full_name, profile_image } = req.body;
        if (!full_name) return errorResponse(res, 'full_name is required.', 400);

        await db.query(
            'UPDATE admin_users SET full_name = ?, profile_image = ? WHERE id = ?',
            [full_name, profile_image || null, req.admin.id]
        );

        return successResponse(res, {}, 'Profile updated successfully.');
    } catch (err) {
        console.error('[updateProfile]', err);
        return errorResponse(res, 'Server error updating profile.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/search-users   (Authenticated)
// ─────────────────────────────────────────────────────────────
export const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        let sql = `
            SELECT u.id, u.full_name as name, r.name as role, u.email 
            FROM admin_users u 
            LEFT JOIN admin_roles r ON u.role_id = r.id 
            WHERE u.is_active = 1
        `;
        const params = [];

        if (query) {
            sql += ' AND (u.full_name LIKE ? OR r.name LIKE ? OR u.email LIKE ?)';
            const wildcard = `%${query}%`;
            params.push(wildcard, wildcard, wildcard);
        }

        const [rows] = await db.query(sql, params);
        
        const formatted = rows.map(u => {
            const initials = u.name ? u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
            return {
                ...u,
                initials,
                color: '#3B82F6', // fallback color
                department: 'Administration' // mock department since it is not in schema
            };
        });

        return successResponse(res, { data: formatted }, 'Users fetched successfully.');
    } catch (err) {
        console.error('[searchUsers]', err);
        return errorResponse(res, 'Server error fetching users.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/change-password/send-otp
// ─────────────────────────────────────────────────────────────
export const sendChangePasswordOtp = async (req, res) => {
    try {
        const email = req.admin.email;
        if (!email) return errorResponse(res, 'Admin email not found in token.', 400);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        await db.query('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0', [email]);
        await db.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 10 MINUTE)',
            [email, otp]
        );

        await sendAdminChangePasswordOtpEmail({ to: email, name: req.admin.full_name || 'Admin', otp }).catch(() => {});
        return successResponse(res, {}, 'OTP sent successfully.');
    } catch (err) {
        console.error('[sendChangePasswordOtp]', err);
        return errorResponse(res, 'Server error sending OTP.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/change-password/verify-otp
// ─────────────────────────────────────────────────────────────
export const verifyChangePasswordOtp = async (req, res) => {
    try {
        const email = req.admin.email;
        const { otp } = req.body;

        if (!otp) return errorResponse(res, 'OTP is required.', 400);

        const [rows] = await db.query(
            'SELECT * FROM password_resets WHERE email = ? AND token = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()',
            [email, otp]
        );

        if (!rows.length) {
            return errorResponse(res, 'Invalid or expired OTP.', 400);
        }

        // Mark OTP as used
        await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [rows[0].id]);

        // Generate temp token for next step
        const temp_token = generateToken(32);
        await db.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 15 MINUTE)',
            [email, temp_token]
        );

        return successResponse(res, { temp_token }, 'OTP verified successfully.');
    } catch (err) {
        console.error('[verifyChangePasswordOtp]', err);
        return errorResponse(res, 'Server error verifying OTP.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/change-password/confirm
// ─────────────────────────────────────────────────────────────
export const confirmChangePassword = async (req, res) => {
    try {
        const email = req.admin.email;
        const { temp_token, new_password } = req.body;

        if (!temp_token || !new_password) {
            return errorResponse(res, 'temp_token and new_password are required.', 400);
        }

        if (new_password.length < 8) {
            return errorResponse(res, 'Password must be at least 8 characters.', 400);
        }

        const [rows] = await db.query(
            'SELECT * FROM password_resets WHERE email = ? AND token = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()',
            [email, temp_token]
        );

        if (!rows.length) {
            return errorResponse(res, 'Invalid or expired token.', 400);
        }

        const hashed = await bcrypt.hash(new_password, 12);
        await db.query('UPDATE admin_users SET password = ? WHERE email = ?', [hashed, email]);
        await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [rows[0].id]);

        return successResponse(res, {}, 'Password updated successfully.');
    } catch (err) {
        console.error('[confirmChangePassword]', err);
        return errorResponse(res, 'Server error confirming password change.');
    }
};
