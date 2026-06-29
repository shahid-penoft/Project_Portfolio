import express from 'express';
import { 
    getAllPrograms, getProgramById, getProgramBySlug, createProgram, updateProgram, deleteProgram,
    addProgramMedia, deleteProgramMedia 
} from '../controllers/programController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// Public routes (if needed, but usually admin)
router.get('/', getAllPrograms);
router.get('/:id', getProgramById);
router.get('/slug/:slug', getProgramBySlug);

// Protected routes
router.post('/', verifyToken, createProgram);
router.put('/:id', verifyToken, updateProgram);
router.delete('/:id', verifyToken, deleteProgram);

router.post('/:id/media', verifyToken, addProgramMedia);
router.delete('/media/:mediaId', verifyToken, deleteProgramMedia);

export default router;
