import db from '../configs/db.js';
import { errorResponse, successResponse } from '../utils/helpers.js';
import { sendAdminInviteEmail } from '../utils/email.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const generateToken = () => crypto.randomBytes(32).toString('hex');

// Get all admin users
export const getAdminUsers = async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT 
                u.id, u.full_name, u.email, u.is_active, u.created_at, u.last_login,
                u.role_id, r.name as role_name, r.is_system
            FROM admin_users u
            LEFT JOIN admin_roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC
        `);
        return successResponse(res, { data: users }, 'Admin users fetched successfully');
    } catch (error) {
        console.error('[getAdminUsers]', error);
        return errorResponse(res, 'Failed to fetch admin users', 500);
    }
};

// Create (Invite) a new admin user
export const createAdminUser = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { full_name, email, role_id } = req.body;
        
        if (!full_name || !email || !role_id) {
            return errorResponse(res, 'Name, email, and role are required', 400);
        }

        // Check if email already exists
        const [existing] = await connection.query('SELECT id FROM admin_users WHERE email = ?', [email]);
        if (existing.length > 0) {
            connection.release();
            return errorResponse(res, 'Email already exists', 400);
        }

        // Fetch role to get the name for the email
        const [roles] = await connection.query('SELECT name FROM admin_roles WHERE id = ?', [role_id]);
        if (roles.length === 0) {
            connection.release();
            return errorResponse(res, 'Invalid role selected', 400);
        }
        const roleName = roles[0].name;

        await connection.beginTransaction();

        // 1. Create the user with a temporary random password
        const randomTempPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomTempPassword, 12);

        const [result] = await connection.query(
            'INSERT INTO admin_users (full_name, email, password, role_id, is_active) VALUES (?, ?, ?, ?, 1)',
            [full_name, email, hashedPassword, role_id]
        );
        const userId = result.insertId;

        // 2. Generate invite token (reusing password_resets table)
        const token = generateToken();
        // Invite link valid for 7 days
        await connection.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 7 DAY)',
            [email, token]
        );

        // 3. Send the email
        await sendAdminInviteEmail({
            to: email,
            name: full_name,
            token,
            roleName
        });

        await connection.commit();
        return successResponse(res, { id: userId }, 'User invited successfully');
    } catch (error) {
        await connection.rollback();
        console.error('[createAdminUser]', error);
        return errorResponse(res, 'Failed to invite user', 500);
    } finally {
        connection.release();
    }
};

// Update an existing admin user
export const updateAdminUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, role_id, is_active } = req.body;

        if (!full_name || !role_id) {
            return errorResponse(res, 'Name and role are required', 400);
        }

        // Protect Superadmin modifications if needed, but since this route is superadmin only, 
        // we mainly want to prevent taking away the superadmin role from the last superadmin.
        // For simplicity, we just allow the update.
        await db.query(
            'UPDATE admin_users SET full_name = ?, role_id = ?, is_active = ? WHERE id = ?',
            [full_name, role_id, is_active, id]
        );

        return successResponse(res, {}, 'User updated successfully');
    } catch (error) {
        console.error('[updateAdminUser]', error);
        return errorResponse(res, 'Failed to update user', 500);
    }
};

// Delete an admin user
export const deleteAdminUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting oneself
        if (req.admin.id == id) {
            return errorResponse(res, 'You cannot delete your own account', 400);
        }

        const [result] = await db.query('DELETE FROM admin_users WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return errorResponse(res, 'User not found', 404);
        }

        return successResponse(res, {}, 'User deleted successfully');
    } catch (error) {
        console.error('[deleteAdminUser]', error);
        return errorResponse(res, 'Failed to delete user', 500);
    }
};
