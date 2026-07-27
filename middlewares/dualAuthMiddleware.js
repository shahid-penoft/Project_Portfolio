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
                `SELECT u.id, u.full_name, u.email, u.is_active, 
                        r.name as role, r.permissions, r.is_system 
                 FROM admin_users u 
                 LEFT JOIN admin_roles r ON u.role_id = r.id 
                 WHERE u.id = ?`,
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

/**
 * Optional Dual Auth Middleware
 * Same as dualAuth, but DOES NOT block unauthenticated requests.
 * Sets req.admin or req.constituent if valid tokens exist, otherwise calls next().
 */
export const optionalDualAuth = async (req, res, next) => {
    const adminToken = req.cookies?.admin_token;
    const constituentToken = req.cookies?.constituent_token;

    if (adminToken) {
        try {
            const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
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
                req.isAdmin = true;
                return next();
            }
        } catch (_) {}
    }

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
        } catch (_) {}
    }

    req.admin = null;
    req.constituent = null;
    req.isAdmin = false;
    next();
};

