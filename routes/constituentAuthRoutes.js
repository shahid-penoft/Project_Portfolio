import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyConstituentToken } from '../middlewares/constituentAuth.js';
import * as C from '../controllers/constituentAuthController.js';

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// Identity Verification (Deprecated)
// router.post('/verify-aadhaar/send-otp', authLimiter, C.sendAadhaarOtp);
// router.post('/verify-aadhaar/confirm-otp', authLimiter, C.confirmAadhaarOtp);
// router.post('/verify-voterid/validate', authLimiter, C.validateVoterId);
// router.post('/verify-voterid/confirm-otp', authLimiter, C.confirmVoterIdOtp);

// Public Auth
router.post('/register/send-otp', authLimiter, C.sendRegistrationOtp);
router.post('/register/verify-otp', authLimiter, C.verifyRegistrationOtp);
router.post('/register', C.registerConstituent);
router.post('/login', authLimiter, C.loginConstituent);
router.post('/forgot-password', authLimiter, C.constituentForgotPassword);
router.post('/reset-password', C.constituentResetPassword);

// Protected
router.use(verifyConstituentToken);
router.get('/me', C.getConstituentProfile);
router.post('/logout', C.constituentLogout);

export default router;
