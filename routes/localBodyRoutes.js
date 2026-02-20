import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getAllLocalBodies, createLocalBody, updateLocalBody, deleteLocalBody } from '../controllers/localBodyController.js';

const router = express.Router();

router.get('/', getAllLocalBodies); // public

router.use(verifyToken);
router.post('/', createLocalBody);
router.put('/:id', updateLocalBody);
router.delete('/:id', deleteLocalBody);

export default router;
