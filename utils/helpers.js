import crypto from 'crypto';

/**
 * Generate a secure random token (hex string)
 */
export const generateToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/**
 * Return UTC datetime N minutes from now (for DB storage)
 */
export const minutesFromNow = (minutes) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    // MySQL DATETIME format
    return d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Standard API success response
 */
export const successResponse = (res, data = {}, message = 'Success', statusCode = 200) =>
    res.status(statusCode).json({ success: true, message, ...data });

/**
 * Standard API error response
 */
export const errorResponse = (res, message = 'Something went wrong', statusCode = 500) =>
    res.status(statusCode).json({ success: false, message });
