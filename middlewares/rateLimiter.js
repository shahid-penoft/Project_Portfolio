import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter to prevent basic DOS attacks and brute force.
 * Limits each IP to 100 requests per minute.
 */
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
