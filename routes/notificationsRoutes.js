import express from 'express';
import {
    sendSMSNotification,
    getSMSStatus,
    sendEmailNotification,
    sendWhatsAppNotification,
    sendBulkNotification,
    getBulkJobStatus,
    cancelBulkJob,
} from '../controllers/notificationsController.js';
import {
  getAdminNotifications,
  markOneAsRead,
  markAllAsRead,
} from '../controllers/adminNotificationsController.js';
import {
  getUserNotifications,
  markAllUserNotificationsRead,
  markOneUserNotificationRead,
} from '../controllers/userNotificationsController.js';
import { verifyToken } from '../middlewares/auth.js';
import { verifyConstituentToken } from '../middlewares/constituentAuth.js';

const router = express.Router();

// ── SMS routes (existing) ──────────────────────────────────
router.post('/sms', verifyToken, sendSMSNotification);
router.get('/sms/status', verifyToken, getSMSStatus);
router.post('/email', verifyToken, sendEmailNotification);
router.post('/whatsapp', verifyToken, sendWhatsAppNotification);

// ── Bulk send routes ───────────────────────────────────────
// POST   /api/notifications/bulk-send         → queue job, return jobId
// GET    /api/notifications/bulk-send/:jobId  → poll progress
// PATCH  /api/notifications/bulk-send/:jobId/cancel
router.post('/bulk-send', verifyToken, sendBulkNotification);
router.get('/bulk-send/:jobId', verifyToken, getBulkJobStatus);
router.patch('/bulk-send/:jobId/cancel', verifyToken, cancelBulkJob);


// ── Admin in-app notification routes ──────────────────────
// GET  /api/notifications/admin
router.get('/admin', verifyToken, getAdminNotifications);

// PATCH /api/notifications/admin/mark-all-read — MUST be before /:id route
router.patch('/admin/mark-all-read', verifyToken, markAllAsRead);

// PATCH /api/notifications/admin/:id/read
router.patch('/admin/:id/read', verifyToken, markOneAsRead);

// ── Constituent (user) in-app notification routes ──────────
// GET  /api/notifications/user
router.get('/user', verifyConstituentToken, getUserNotifications);

// PATCH /api/notifications/user/mark-all-read — MUST be before /:id route
router.patch('/user/mark-all-read', verifyConstituentToken, markAllUserNotificationsRead);

// PATCH /api/notifications/user/:id/read
router.patch('/user/:id/read', verifyConstituentToken, markOneUserNotificationRead);

export default router;
