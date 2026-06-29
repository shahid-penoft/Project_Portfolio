import express from 'express';
import {
    getAllTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate
} from '../controllers/templateController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// All template routes require admin authentication
router.use(verifyToken, requirePermission('enquiries'));

router.get('/', getAllTemplates);
router.get('/:id', getTemplateById);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;
