import express from 'express';
import rateLimit from 'express-rate-limit';
import { trackPetition } from '../controllers/petitionsController.js';

const router = express.Router();

/**
 * Scoped rate limiter: 15 track requests per minute per IP.
 * More permissive than the contact form but tighter than the global 200/min.
 */
const trackLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,   // 1 minute
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many tracking requests. Please wait a moment before trying again.',
    },
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json(options.message);
    },
});

// ── Public: no auth required ──────────────────────────────────────────────────
// GET /api/petitions/track?ref=M-CMP-104
// GET /api/petitions/track?phone=9847100000
router.get('/track', trackLimiter, trackPetition);

export default router;
