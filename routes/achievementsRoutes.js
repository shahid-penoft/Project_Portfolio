import express from 'express';
import {
    getAchievements,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    promoteAchievement,
} from '../controllers/achievementsController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.get('/', getAchievements);

// Protected
router.use(verifyToken);
router.post('/', createAchievement);
router.put('/:id', updateAchievement);
router.delete('/:id', deleteAchievement);
router.put('/:id/promote', promoteAchievement);

export default router;
