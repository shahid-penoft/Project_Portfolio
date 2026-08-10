import express from 'express';
import { getHomeStats } from '../controllers/homeStatsController.js';

const router = express.Router();

// GET /api/home/stats (public)
router.get('/', getHomeStats);

export default router;
