import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    uploadProjectImage,
    uploadProjectInlineImage,
} from '../controllers/projectController.js';

const router = express.Router();

// All project routes are protected (admin only)
router.use(verifyToken);

router.post('/upload', uploadProjectImage);
router.post('/:id/upload-inline-image', uploadProjectInlineImage);
router.get('/all', getAllProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
