import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    uploadProjectImage,
    uploadProjectVideo,
    uploadProjectInlineImage,
    getProjectsByYear,
    getProjectsByLocalBody,
    getProjectsBySector,
    searchPublicProjects,
    getProjectBySlug,
    getProjectsBySectorName
} from '../controllers/projectController.js';

const router = express.Router();

// Public routes (must be defined before verifyToken)
router.get('/public/slug/:slug', (req, res, next) => { console.log('DEBUG: Hit public slug route'); next(); }, getProjectBySlug);
router.get('/slug/:slug', (req, res, next) => { console.log('DEBUG: Hit shortened slug route'); next(); }, getProjectBySlug);
router.get('/public', getAllProjects);
router.get('/public/:id', getProjectById);
router.get('/public/year/:year', getProjectsByYear);
router.get('/public/local-body/:id', getProjectsByLocalBody);
router.get('/public/sector/:id', getProjectsBySector);
router.get('/public/sector-name/:sectorName', getProjectsBySectorName);
router.get('/public/search', searchPublicProjects);



// All project routes are protected (admin only)
router.use(verifyToken);

router.post('/upload', uploadProjectImage);
router.post('/upload-video', uploadProjectVideo);
router.post('/:id/upload-inline-image', uploadProjectInlineImage);
router.get('/all', getAllProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
