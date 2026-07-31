import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import * as ctrl from '../controllers/informationCenterController.js';

const router = express.Router();

// ── Public Read (constituent + admin panel reads) ─────────────
router.get('/',     ctrl.getAll);
router.get('/:id',  ctrl.getById);

// ── Activity log ───────────────────────────────────────────────
router.get('/:id/activity', verifyToken, ctrl.getActivity);

// ── Write operations (require auth + multipart upload) ─────────
router.post(  '/',     verifyToken, ctrl.uploadInfoCenter, ctrl.create);
router.put(   '/:id',  verifyToken, ctrl.uploadInfoCenter, ctrl.update);
router.delete('/:id',  verifyToken, ctrl.remove);

export default router;
