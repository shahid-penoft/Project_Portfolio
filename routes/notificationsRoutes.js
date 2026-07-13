import express from 'express';
import { sendSMSNotification, getSMSStatus } from '../controllers/notificationsController.js';
import { verifyToken } from '../middlewares/auth.js';  // admin-only guard

const router = express.Router();

// POST /api/notifications/sms — Admin only
router.post('/sms', verifyToken, sendSMSNotification);

// GET  /api/notifications/sms/status — Admin only
router.get('/sms/status', verifyToken, getSMSStatus);

export default router;
