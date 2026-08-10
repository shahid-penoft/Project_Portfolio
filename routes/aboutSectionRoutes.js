import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getAboutSection, updateAboutSection, uploadAboutImage } from '../controllers/aboutSectionController.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';

const router = express.Router();

// Public route
router.get('/', getAboutSection);

// Protected routes
router.put('/', verifyToken, updateAboutSection);
router.post('/upload', verifyToken, uploadAboutImage);

export default router;
