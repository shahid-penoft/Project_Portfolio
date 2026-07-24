import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import * as ctrl from '../controllers/informationCenterController.js';

const router = express.Router();

// ── Public (admin panel reads — protected behind verifyToken) ──
router.get('/',     verifyToken, ctrl.getAll);
router.get('/:id',  verifyToken, ctrl.getById);

// ── Activity log ───────────────────────────────────────────────
router.get('/:id/activity', verifyToken, ctrl.getActivity);

// ── Write operations (require auth + multipart upload) ─────────
router.post(  '/',     verifyToken, ctrl.uploadInfoCenter, ctrl.create);
router.put(   '/:id',  verifyToken, ctrl.uploadInfoCenter, ctrl.update);
router.delete('/:id',  verifyToken, ctrl.remove);

export default router;
