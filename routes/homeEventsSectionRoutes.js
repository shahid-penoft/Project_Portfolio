import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getHomeEventsSection, updateHomeEventsSection } from '../controllers/homeEventsSectionController.js';

const router = express.Router();

// GET /api/home/events-section (public)
router.get('/', getHomeEventsSection);

// PUT /api/home/events-section (protected)
router.put('/', verifyToken, updateHomeEventsSection);

export default router;
