import express from 'express';
import {
    getDevGoals, createDevGoal, updateDevGoal,
    deleteDevGoal, promoteDevGoal,
} from '../controllers/manifestoDevGoalsController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.get('/', getDevGoals);

// Protected
router.use(verifyToken);
router.post('/', createDevGoal);
router.put('/:id', updateDevGoal);
router.delete('/:id', deleteDevGoal);
router.put('/:id/promote', promoteDevGoal);

export default router;
