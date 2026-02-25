import express from 'express';
import {
    getGalleryImages, getGalleryVideos,
    listUploadedFiles, deleteUploadedFile,
    listAdminMedia, deleteEventMedia,
} from '../controllers/galleryController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Public — event_media DB (grouped, for public gallery pages)
router.get('/images', getGalleryImages);
router.get('/videos', getGalleryVideos);

// Admin — file system browser
router.get('/admin/files', verifyToken, listUploadedFiles);
router.delete('/admin/files/:filename', verifyToken, deleteUploadedFile);

// Admin — event_media gallery (flat list + delete from DB + disk)
router.get('/admin/media', verifyToken, listAdminMedia);
router.delete('/admin/media/:id', verifyToken, deleteEventMedia);

export default router;
