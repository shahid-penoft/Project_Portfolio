import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    uploadCareDocument,
    getApplications,
    getApplicationById,
    createApplication,
    updateApplication,
    updateStatus,
    deleteApplication,
} from '../controllers/mlaCareController.js';
import {
    validateMlaCarePayload,
    validateMlaCareUpdatePayload,
    validateMlaCareStatusPayload,
} from '../middlewares/validateMlaCare.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

/** Rate limiter: Max 10 care submissions per 15 minutes per IP */
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many application requests from this IP. Please wait 15 minutes before trying again.',
    },
});

/** Admin guard: all management routes below require an authenticated site_settings admin */
const adminGuard = [verifyToken, requirePermission('site_settings')];

// POST /api/mla-care/upload-document - Upload medical document (public)
router.post('/upload-document', uploadCareDocument);

// GET /api/mla-care - Fetch applications list (admin)
router.get('/', adminGuard, getApplications);

// GET /api/mla-care/:id - Fetch single application (admin)
router.get('/:id', adminGuard, getApplicationById);

// POST /api/mla-care - Submit new application (public, rate-limited + validated)
router.post('/', submissionLimiter, validateMlaCarePayload, createApplication);

// PUT /api/mla-care/:id - Update application (admin)
router.put('/:id', adminGuard, validateMlaCareUpdatePayload, updateApplication);

// PATCH /api/mla-care/:id/status - Update application status (admin)
router.patch('/:id/status', adminGuard, validateMlaCareStatusPayload, updateStatus);

// DELETE /api/mla-care/:id - Remove application (admin)
router.delete('/:id', adminGuard, deleteApplication);

export default router;
