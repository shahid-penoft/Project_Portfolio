import express from 'express';
import { getCards, createCard, updateCard, deleteCard, promoteCard } from '../controllers/enteNaduController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadIcon } from '../configs/multerS3.js';

const router = express.Router();

router.get('/', getCards);
router.post('/', verifyToken, uploadIcon, createCard);
router.put('/:id', verifyToken, uploadIcon, updateCard);
router.put('/:id/promote', verifyToken, promoteCard);
router.delete('/:id', verifyToken, deleteCard);

export default router;
