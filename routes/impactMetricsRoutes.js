import express from 'express';
import { getMetrics, createMetric, updateMetric, deleteMetric } from '../controllers/impactMetricsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadIcon } from '../configs/multerS3.js'; // Reusing icon upload config

const router = express.Router();

router.get('/', getMetrics);
router.post('/', verifyToken, uploadIcon, createMetric);
router.put('/:id', verifyToken, uploadIcon, updateMetric);
router.delete('/:id', verifyToken, deleteMetric);

export default router;
