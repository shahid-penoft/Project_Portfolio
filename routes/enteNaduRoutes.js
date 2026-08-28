import express from 'express';
import { getCards, createCard, updateCard, deleteCard, promoteCard, getSectionMeta, updateSectionMeta, uploadSectionImage } from '../controllers/enteNaduController.js';
import { verifyToken } from '../middlewares/auth.js';
import { uploadIcon, uploadImage, runMulter } from '../configs/multerS3.js';

const router = express.Router();

// Public
router.get('/section', getSectionMeta);
router.get('/', getCards);

// Protected - specific sub-routes before parameterized /:id routes
router.put('/section', verifyToken, updateSectionMeta);
router.post('/section/upload', verifyToken, uploadSectionImage);

router.post('/', verifyToken, uploadIcon, createCard);
router.put('/:id/promote', verifyToken, promoteCard);
router.put('/:id', verifyToken, uploadIcon, updateCard);
router.delete('/:id', verifyToken, deleteCard);

export default router;
