import jwt from 'jsonwebtoken';
import db from '../configs/db.js';

/**
 * Protect routes — verifies JWT exclusively from HTTP-only cookie (JS cannot access it)
 */
export const verifyConstituentToken = async (req, res, next) => {
    try {
        // Read exclusively from HTTP-only cookie
        const token = req.cookies?.constituent_token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.CONSTITUENT_JWT_SECRET);

        // Fetch fresh user from DB
        const [rows] = await db.query(
            'SELECT id, full_name, phone, email, is_active FROM constituent_users WHERE id = ?',
            [decoded.id]
        );

        if (!rows.length || !rows[0].is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account not found or deactivated.',
            });
        }

        req.constituent = rows[0];
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};
