import express from 'express';
import {
    getGalleryImages, getGalleryVideos,
    listUploadedFiles, deleteUploadedFile,
    listAdminMedia, deleteEventMedia,
    getImagesByLocalBody, getImagesBySector, getImagesByYear, searchImages,
    getVideosByLocalBody, getVideosBySector, getVideosByYear, searchVideos,
} from '../controllers/galleryController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// ── Public: existing grouped gallery ──────────────────────────
router.get('/images', getGalleryImages);
router.get('/videos', getGalleryVideos);

// ── Public: images filter & search ────────────────────────────
router.get('/images/local-body/:id', getImagesByLocalBody);
router.get('/images/sector/:id', getImagesBySector);
router.get('/images/year/:year', getImagesByYear);
router.get('/images/search', searchImages);

// ── Public: videos filter & search ────────────────────────────
router.get('/videos/local-body/:id', getVideosByLocalBody);
router.get('/videos/sector/:id', getVideosBySector);
router.get('/videos/year/:year', getVideosByYear);
router.get('/videos/search', searchVideos);

// ── Admin: file system browser ────────────────────────────────
router.get('/admin/files', verifyToken, listUploadedFiles);
router.delete('/admin/files/:filename', verifyToken, deleteUploadedFile);

// ── Admin: event_media gallery (flat list + delete) ───────────
router.get('/admin/media', verifyToken, listAdminMedia);
router.delete('/admin/media/:id', verifyToken, deleteEventMedia);

export default router;
