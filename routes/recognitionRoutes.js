import express from 'express';
import {
    getAllRecognitions,
    createRecognition,
    updateRecognition,
    deleteRecognition,
    promoteRecognition
} from '../controllers/recognitionController.js';
import { verifyToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', getAllRecognitions);

// Protect all other routes to admin/superadmin only
router.use(verifyToken);
router.use(requireRole(['superadmin', 'admin']));

router.post('/', createRecognition);
router.put('/:id', updateRecognition);
router.delete('/:id', deleteRecognition);
router.put('/:id/promote', promoteRecognition);

export default router;
