import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { getAllEventTypes, createEventType, updateEventType, deleteEventType } from '../controllers/eventTypeController.js';

const router = express.Router();

router.get('/', getAllEventTypes); // public

router.use(verifyToken, requirePermission('events'));
router.post('/', createEventType);
router.put('/:id', updateEventType);
router.delete('/:id', deleteEventType);

export default router;
