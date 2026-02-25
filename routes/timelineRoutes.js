import express from 'express';
import {
    getAllTimelines,
    createTimeline,
    updateTimeline,
    deleteTimeline
} from '../controllers/timelineController.js';
import { verifyToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', getAllTimelines);

// Protect all other routes to admin/superadmin only
router.use(verifyToken);
router.use(requireRole(['superadmin', 'admin']));

router.post('/', createTimeline);
router.put('/:id', updateTimeline);
router.delete('/:id', deleteTimeline);

export default router;
