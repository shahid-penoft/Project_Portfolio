import express from 'express';
import { getGalleryImages, getGalleryVideos } from '../controllers/galleryController.js';

const router = express.Router();

// All gallery endpoints are public
router.get('/images', getGalleryImages);
router.get('/videos', getGalleryVideos);

export default router;
