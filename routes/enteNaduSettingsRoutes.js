import express from 'express';
import {
    getEnteNaduSettings,
    updateEnteNaduSettings,
} from '../controllers/enteNaduSettingsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// ─── Public ────────────────────────────────────────────────────────────────
// GET /api/ente-nadu-settings?site=portfolio|mlaconnect|all
router.get('/', getEnteNaduSettings);

// ─── Protected (admin only) ────────────────────────────────────────────────
router.use(verifyToken, requirePermission('website'));

// PUT /api/ente-nadu-settings
router.put('/', updateEnteNaduSettings);

export default router;
