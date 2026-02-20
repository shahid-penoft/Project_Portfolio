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
            'SELECT id, full_name, email, role, is_active FROM admin_users WHERE id = ?',
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
 * Role guard — usage: requireRole('superadmin')  or  requireRole(['superadmin','admin'])
 */
export const requireRole = (roles) => (req, res, next) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(req.admin?.role)) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden. You do not have permission to perform this action.',
        });
    }
    next();
};
