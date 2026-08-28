import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter to prevent basic DOS attacks and brute force.
 * Limits each IP to 1000 requests per minute for public unauthenticated traffic.
 * Skips authenticated admins, local dev environments, and static/health checks.
 */
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
        // Skip in local development
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            return true;
        }
        // Skip preflight requests
        if (req.method === 'OPTIONS') {
            return true;
        }
        // Skip authenticated admin requests
        const authHeader = req.headers.authorization;
        const hasToken = (authHeader && authHeader.startsWith('Bearer ')) || req.cookies?.token || req.cookies?.admin_token;
        if (hasToken) {
            return true;
        }
        return false;
    },
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after a minute',
    },
});

/**
 * Stricter rate limiter specifically for the contact form to prevent spam.
 * Limits each IP to 3 submissions per 15 minutes.
 */
export const contactFormLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Limit each IP to 3 submissions per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many contact form submissions from this IP. Please try again after 15 minutes.',
    },
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json(options.message);
    },
});
