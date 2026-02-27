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
    getProjectsByYear,
    getProjectsByLocalBody,
    getProjectsBySector,
    searchPublicProjects
} from '../controllers/projectController.js';

const router = express.Router();

// Public routes (must be defined before verifyToken)
router.get('/public/year/:year', getProjectsByYear);
router.get('/public/local-body/:id', getProjectsByLocalBody);
router.get('/public/sector/:id', getProjectsBySector);
router.get('/public/search', searchPublicProjects);

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
