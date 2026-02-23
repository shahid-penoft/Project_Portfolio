import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getHero, updateHero, uploadHeroImage } from '../controllers/heroController.js';

const router = express.Router();

// Public route to get hero data
router.get('/', getHero);

// Protected routes to manage hero data
router.put('/', verifyToken, updateHero);
router.post('/upload', verifyToken, uploadHeroImage);

export default router;
