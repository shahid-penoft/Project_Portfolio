import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getHomeStats, updateHomeStats } from '../controllers/homeStatsController.js';

const router = express.Router();

// GET /api/home/stats (public)
router.get('/', getHomeStats);

// PUT /api/home/stats (protected)
router.put('/', verifyToken, updateHomeStats);

export default router;
