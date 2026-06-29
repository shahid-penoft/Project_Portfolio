import express from 'express';
import {
    getAllStories,
    createStory,
    updateStory,
    deleteStory
} from '../controllers/visualStoryController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', getAllStories);

router.use(verifyToken, requirePermission('home'));
router.use(requirePermission('home'));

router.post('/', createStory);
router.put('/:id', updateStory);
router.delete('/:id', deleteStory);

export default router;
