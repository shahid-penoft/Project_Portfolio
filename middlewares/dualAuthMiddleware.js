import jwt from 'jsonwebtoken';
import db from '../configs/db.js';

/**
 * Dual Auth Middleware
 * Accepts EITHER an admin_token (admin panel) OR constituent_token (MLA Connect portal).
 * Reads `x-app-portal` header to prevent token collision (e.g. an admin using the constituent portal).
 * Sets req.admin  → if admin token is valid
 * Sets req.constituent → if constituent token is valid
 * req.isAdmin → boolean convenience flag
 */
export const dualAuth = async (req, res, next) => {
    const adminToken = req.cookies?.admin_token;
    const constituentToken = req.cookies?.constituent_token;
    const portal = req.headers['x-app-portal']; // 'admin' or 'constituent'

    // ── 0. Explicitly public — reject (dualAuth requires authentication) ──
    if (portal === 'public') {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please log in.',
        });
    }

    // ── 1. If portal explicitly requests constituent context ──
    if (portal === 'constituent' && constituentToken) {
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
        // If constituent portal but token invalid, force login (ignore admin token)
        return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    // ── 2. If portal explicitly requests admin context ──
    if (portal === 'admin' && adminToken) {
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
        // If admin portal but token invalid, force login
        return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    // ── 3. Fallback for no header (e.g. legacy clients, postman) ──
    if (!portal) {
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
 */
export const optionalDualAuth = async (req, res, next) => {
    const adminToken = req.cookies?.admin_token;
    const constituentToken = req.cookies?.constituent_token;
    const portal = req.headers['x-app-portal'];

    // ── 0. Explicitly public — treat as fully anonymous, ignore all cookies ──
    if (portal === 'public') {
        req.admin = null;
        req.constituent = null;
        req.isAdmin = false;
        return next();
    }

    if (portal === 'constituent' && constituentToken) {
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
    } else if (portal === 'admin' && adminToken) {
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
    } else if (!portal) {
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
    }

    req.admin = null;
    req.constituent = null;
    req.isAdmin = false;
    next();
};

