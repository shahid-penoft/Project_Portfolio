import express from 'express';
import { getCards, createCard, updateCard, deleteCard, promoteCard, getSectionMeta, updateSectionMeta, uploadSectionImage } from '../controllers/enteNaduController.js';
import { verifyToken } from '../middlewares/auth.js';
import { uploadIcon, uploadImage, runMulter } from '../configs/multerS3.js';

const router = express.Router();

// Public
router.get('/', getCards);
router.get('/section', getSectionMeta);

// Protected
router.post('/', verifyToken, uploadIcon, createCard);
router.put('/:id', verifyToken, uploadIcon, updateCard);
router.put('/:id/promote', verifyToken, promoteCard);
router.delete('/:id', verifyToken, deleteCard);
router.put('/section', verifyToken, updateSectionMeta);
router.post('/section/upload', verifyToken, uploadSectionImage);

export default router;
