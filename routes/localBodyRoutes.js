import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { getAllLocalBodies, createLocalBody, updateLocalBody, deleteLocalBody, uploadLocalBodyImage } from '../controllers/localBodyController.js';

const router = express.Router();

router.get('/', getAllLocalBodies); // public

router.use(verifyToken, requirePermission('enquiries'));
router.post('/upload', uploadLocalBodyImage);
router.post('/', createLocalBody);
router.put('/:id', updateLocalBody);
router.delete('/:id', deleteLocalBody);

export default router;
