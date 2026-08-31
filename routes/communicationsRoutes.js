import express from 'express';
import { getCommunications } from '../controllers/communicationsController.js';
import { verifyToken as adminAuth } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/communications - Unified server-side paginated & filtered endpoint
router.get('/', adminAuth, getCommunications);

export default router;
