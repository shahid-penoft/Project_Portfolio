import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { getAllLocalBodies, getLocalBodiesWithWards, createLocalBody, updateLocalBody, deleteLocalBody, uploadLocalBodyImage } from '../controllers/localBodyController.js';

const router = express.Router();

router.get('/all-with-wards', getLocalBodiesWithWards); // public hierarchical route
router.get('/', getAllLocalBodies); // public

router.use(verifyToken, requirePermission('enquiries'));
router.post('/upload', uploadLocalBodyImage);
router.post('/', createLocalBody);
router.put('/:id', updateLocalBody);
router.delete('/:id', deleteLocalBody);

export default router;
