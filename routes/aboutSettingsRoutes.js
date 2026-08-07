import express from 'express';
import {
    getAboutSettings,
    updateAboutSettings,
    uploadSectionImage,
} from '../controllers/aboutSettingsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// ─── Public ────────────────────────────────────────────────────────────────
// GET /api/about-settings?site=portfolio|mlaconnect|all
router.get('/', getAboutSettings);

// ─── Protected (admin only) ────────────────────────────────────────────────
router.use(verifyToken, requirePermission('about'));

// PUT /api/about-settings
router.put('/', updateAboutSettings);

// POST /api/about-settings/upload-image
router.post('/upload-image', uploadSectionImage);

export default router;
