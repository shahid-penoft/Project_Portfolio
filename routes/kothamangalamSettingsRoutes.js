import express from 'express';
import {
    getKothamangalamSettings,
    updateKothamangalamSettings,
    uploadKothamangalamImage,
} from '../controllers/kothamangalamSettingsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// ─── Public ────────────────────────────────────────────────────────────────
// GET /api/kothamangalam-settings?site=portfolio|mlaconnect|all
router.get('/', getKothamangalamSettings);

// ─── Protected (admin only) ────────────────────────────────────────────────
router.use(verifyToken, requirePermission('website'));

// PUT /api/kothamangalam-settings
router.put('/', updateKothamangalamSettings);

// POST /api/kothamangalam-settings/upload-image
router.post('/upload-image', uploadKothamangalamImage);

export default router;
