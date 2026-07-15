import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import * as ctrl from '../controllers/busTimingsController.js';

const router = express.Router();

router.get('/', ctrl.getAll);
router.post('/', verifyToken, ctrl.create);
router.put('/:id', verifyToken, ctrl.update);
router.delete('/:id', verifyToken, ctrl.remove);

export default router;
