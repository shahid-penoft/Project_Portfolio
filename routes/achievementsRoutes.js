import express from 'express';
import {
    getAchievements,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    promoteAchievement,
} from '../controllers/achievementsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { safeUploadIcon } from '../configs/multerS3.js';

const router = express.Router();

// Public
router.get('/', getAchievements);

// Protected
router.use(verifyToken, requirePermission('ente_nadu'));
router.post('/', safeUploadIcon, createAchievement);
router.put('/:id', safeUploadIcon, updateAchievement);
router.delete('/:id', deleteAchievement);
router.put('/:id/promote', promoteAchievement);

export default router;
