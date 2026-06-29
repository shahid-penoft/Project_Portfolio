import express from 'express';
import {
    getAllRecognitions,
    createRecognition,
    updateRecognition,
    deleteRecognition,
    promoteRecognition
} from '../controllers/recognitionController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { safeUploadIcon } from '../configs/multerS3.js';

const router = express.Router();

router.get('/', getAllRecognitions);

// Protect all other routes to admin/superadmin only
router.use(verifyToken, requirePermission('about'));
router.use(requirePermission('about'));

router.post('/', safeUploadIcon, createRecognition);
router.put('/:id', safeUploadIcon, updateRecognition);
router.delete('/:id', deleteRecognition);
router.put('/:id/promote', promoteRecognition);

export default router;
