import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import {
    getKothamangalamImages,
    getKothamangalamVideos,
    getAllAdminGallery,
    createGalleryItem,
    updateGalleryItem,
    deleteGalleryItem
} from '../controllers/kothamangalamGalleryController.js';

const router = express.Router();

// ── Public Routes ───────────────────────────────────────────
router.get('/images', getKothamangalamImages);
router.get('/videos', getKothamangalamVideos);

// ── Admin Routes ────────────────────────────────────────────
// Use existing generic File Upload route logic to upload actual files (already on the frontend)
// These routes handle the database records for the Kothamangalam Gallery feature.
router.get('/admin', verifyToken, getAllAdminGallery);
router.post('/admin/upload', verifyToken, createGalleryItem);
router.put('/admin/:id', verifyToken, updateGalleryItem);
router.delete('/admin/:id', verifyToken, deleteGalleryItem);

export default router;
