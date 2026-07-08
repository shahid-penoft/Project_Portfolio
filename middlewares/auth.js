import jwt from 'jsonwebtoken';
import db from '../configs/db.js';

/**
 * Protect routes — verifies JWT exclusively from HTTP-only cookie (JS cannot access it)
 */
export const verifyToken = async (req, res, next) => {
    try {
        // Read exclusively from HTTP-only cookie — inaccessible to JavaScript
        const token = req.cookies?.admin_token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch fresh user from DB (ensures deactivated accounts are blocked instantly)
        const [rows] = await db.query(
            `SELECT u.id, u.full_name, u.email, u.is_active, 
                    r.name as role, r.permissions, r.is_system 
             FROM admin_users u 
             LEFT JOIN admin_roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [decoded.id]
        );

        if (!rows.length || !rows[0].is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account not found or deactivated.',
            });
        }

        req.admin = rows[0];
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

/**
 * Optional Protect routes — verifies JWT exclusively from HTTP-only cookie if it exists.
 * Does not block if token is missing or invalid, just leaves req.admin undefined.
 */
export const optionalVerifyToken = async (req, res, next) => {
    try {
        const token = req.cookies?.admin_token;
        if (!token) return next();

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [rows] = await db.query(
            `SELECT u.id, u.full_name, u.email, u.is_active, 
                    r.name as role, r.permissions, r.is_system 
             FROM admin_users u 
             LEFT JOIN admin_roles r ON u.role_id = r.id 
             WHERE u.id = ?`,
            [decoded.id]
        );

        if (rows.length && rows[0].is_active) {
            req.admin = rows[0];
        }
        next();
    } catch (err) {
        next();
    }
};

/**
 * Permission guard — usage: requirePermission('projects') or requirePermission(['projects', 'dashboard'])
 */
export const requirePermission = (permissions) => (req, res, next) => {
    // Superadmins bypass all permission checks
    if (req.admin?.is_system || req.admin?.role?.toLowerCase() === 'superadmin') {
        return next();
    }

    const required = Array.isArray(permissions) ? permissions : [permissions];
    
    // Parse permissions if it's a string from DB (JSON)
    let userPerms = req.admin?.permissions || [];
    if (typeof userPerms === 'string') {
        try {
            userPerms = JSON.parse(userPerms);
        } catch (e) {
            userPerms = [];
        }
    }

    // Check if user has at least one of the required permissions
    const hasPermission = required.some(perm => userPerms.includes(perm));

    if (!hasPermission) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden. You do not have permission to access this module.',
        });
    }
    next();
};
