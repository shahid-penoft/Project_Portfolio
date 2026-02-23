import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import {
    getPublicSections,
    getAllSections,
    createSection,
    updateSection,
    deleteSection,
    getLatestUpdates,
    getPostsBySection,
    getAllPosts,
    getPostById,
    createPost,
    updatePost,
    deletePost,
    uploadMediaFile,
} from '../controllers/mediaCentreController.js';

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────
router.get('/latest', getLatestUpdates);
router.get('/sections', getPublicSections);
router.get('/sections/all', getAllSections);       // ← must be before /:id wildcard
router.get('/sections/:id/posts', getPostsBySection);
router.get('/posts/:id', getPostById);

// ─── Protected (cookie JWT) ───────────────────────────────────
router.use(verifyToken);

router.post('/upload', uploadMediaFile);          // ← file upload
router.post('/sections', createSection);
router.put('/sections/:id', updateSection);
router.delete('/sections/:id', deleteSection);

router.get('/posts', getAllPosts);
router.post('/posts', createPost);
router.put('/posts/:id', updatePost);
router.delete('/posts/:id', deletePost);

export default router;
