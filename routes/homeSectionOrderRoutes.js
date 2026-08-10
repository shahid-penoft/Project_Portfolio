import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getSectionOrder, updateSectionOrder } from '../controllers/homeSectionOrderController.js';

const router = express.Router();

// GET /api/home/section-order (public — needed for admin UI to load on mount)
router.get('/', getSectionOrder);

// PUT /api/home/section-order (protected)
router.put('/', verifyToken, updateSectionOrder);

export default router;
