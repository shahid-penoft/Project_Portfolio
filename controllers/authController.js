import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../configs/db.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../utils/email.js';
import { generateToken, minutesFromNow, successResponse, errorResponse } from '../utils/helpers.js';

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
        const { email, password } = req.body;

        if (!email || !password)
            return errorResponse(res, 'Email and password are required.', 400);

        const [rows] = await db.query('SELECT * FROM admin_users WHERE email = ?', [email]);
        if (!rows.length)
            return errorResponse(res, 'Invalid email or password.', 401);

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
            sameSite: 'strict',                                 // CSRF protection
            maxAge: 7 * 24 * 60 * 60 * 1000,                // 7 days
            path: '/',
        });

        const { password: _, ...adminData } = admin;
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
        const { email } = req.body;
        if (!email) return errorResponse(res, 'Email is required.', 400);

        const [rows] = await db.query(
            'SELECT id, full_name, email FROM admin_users WHERE email = ? AND is_active = 1',
            [email]
        );

        // Always return the same message (prevents email enumeration)
        if (!rows.length)
            return successResponse(res, {}, 'If that email exists, a reset link has been sent.');

        const admin = rows[0];
        const token = generateToken();
        const expiresAt = minutesFromNow(30); // 30-minute expiry

        // Invalidate previous tokens for this email
        await db.query('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0', [email]);

        // Insert new token (expires_at stored in UTC to match UTC_TIMESTAMP() comparisons)
        await db.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 30 MINUTE)',
            [email, token]
        );

        await sendPasswordResetEmail({ to: email, name: admin.full_name, token });

        return successResponse(res, {}, 'If that email exists, a reset link has been sent.');
    } catch (err) {
        console.error('[forgotPassword]', err);
        return errorResponse(res, 'Server error. Please try again later.');
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

        await db.query('UPDATE admin_users SET password = ? WHERE email = ?', [hashed, resetRecord.email]);
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
export const logout = (req, res) => {
    res.clearCookie('admin_token', { path: '/' });
    return successResponse(res, {}, 'Logged out successfully.');
};

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/profile   (Authenticated)
// ─────────────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, full_name, email, role, profile_image, last_login, created_at FROM admin_users WHERE id = ?',
            [req.admin.id]
        );
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
