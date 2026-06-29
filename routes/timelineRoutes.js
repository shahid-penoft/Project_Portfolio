import express from 'express';
import {
    getAllTimelines,
    createTimeline,
    updateTimeline,
    deleteTimeline
} from '../controllers/timelineController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', getAllTimelines);

// Protect all other routes to admin/superadmin only
router.use(verifyToken, requirePermission('about'));
router.use(requirePermission('about'));

router.post('/', createTimeline);
router.put('/:id', updateTimeline);
router.delete('/:id', deleteTimeline);

export default router;
