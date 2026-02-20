import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getAllEventTypes, createEventType, updateEventType, deleteEventType } from '../controllers/eventTypeController.js';

const router = express.Router();

router.get('/', getAllEventTypes); // public

router.use(verifyToken);
router.post('/', createEventType);
router.put('/:id', updateEventType);
router.delete('/:id', deleteEventType);

export default router;
