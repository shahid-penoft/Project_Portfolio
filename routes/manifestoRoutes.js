import express from 'express';
import {
    getCommitments, createCommitment, updateCommitment,
    deleteCommitment, promoteCommitment, uploadCommitmentIcon,
} from '../controllers/manifestoLongTermController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.get('/', getCommitments);

// Protected
router.use(verifyToken);
router.post('/upload', uploadCommitmentIcon);
router.post('/', createCommitment);
router.put('/:id', updateCommitment);
router.delete('/:id', deleteCommitment);
router.put('/:id/promote', promoteCommitment);

export default router;
