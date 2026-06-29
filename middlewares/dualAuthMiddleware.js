import jwt from 'jsonwebtoken';
import db from '../configs/db.js';

/**
 * Dual Auth Middleware
 * Accepts EITHER an admin_token (admin panel) OR constituent_token (MLA Connect portal).
 * Sets req.admin  → if admin token is valid
 * Sets req.constituent → if constituent token is valid
 * req.isAdmin → boolean convenience flag
 */
export const dualAuth = async (req, res, next) => {
    const adminToken = req.cookies?.admin_token;
    const constituentToken = req.cookies?.constituent_token;

    // ── Try admin token first ──
    if (adminToken) {
        try {
            const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
            const [rows] = await db.query(
                'SELECT id, full_name, email, role, is_active FROM admin_users WHERE id = ?',
                [decoded.id]
            );
            if (rows.length && rows[0].is_active) {
                req.admin = rows[0];
                req.isAdmin = true;
                return next();
            }
        } catch (_) {
            // fall through to constituent check
        }
    }

    // ── Try constituent token ──
    if (constituentToken) {
        try {
            const decoded = jwt.verify(constituentToken, process.env.CONSTITUENT_JWT_SECRET);
            const [rows] = await db.query(
                'SELECT id, full_name, phone, email, is_active FROM constituent_users WHERE id = ?',
                [decoded.id]
            );
            if (rows.length && rows[0].is_active) {
                req.constituent = rows[0];
                req.isAdmin = false;
                return next();
            }
        } catch (_) {
            // fall through
        }
    }

    return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
    });
};

/**
 * Admin-only guard — use after dualAuth to restrict a route to admins only.
 */
export const adminOnly = (req, res, next) => {
    if (!req.isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden. Admin access required.',
        });
    }
    next();
};
