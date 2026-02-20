import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../middlewares/auth.js';
import {
    register,
    login,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    getProfile,
    updateProfile,
} from '../controllers/authController.js';

const router = express.Router();

// ─── Rate limiters ────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { success: false, message: 'Too many password reset requests. Please try again after 1 hour.' },
});

// ─── Public Routes ───────────────────────────────────────────
router.post('/login', authLimiter, login);
router.post('/forgot-password', forgotLimiter, forgotPassword);
router.post('/reset-password', resetPassword);

// ─── Protected Routes (cookie JWT required) ───────────────────
router.use(verifyToken);

router.post('/register', register);
router.post('/logout', logout);
router.post('/change-password', changePassword);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;
