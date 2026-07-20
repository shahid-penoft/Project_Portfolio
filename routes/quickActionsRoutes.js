import express from 'express';
import { getUnifiedItems } from '../controllers/quickActionsController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

router.get('/unified', verifyToken, getUnifiedItems);

export default router;
