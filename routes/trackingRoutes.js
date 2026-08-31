import express from 'express';
import { getTrackingRecords } from '../controllers/trackingController.js';
import { verifyToken as adminAuth } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/tracking - Unified server-side global tracking & search endpoint
router.get('/', adminAuth, getTrackingRecords);

export default router;
