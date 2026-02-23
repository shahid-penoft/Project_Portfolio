import express from 'express';
import {
    getPillars, createPillar, updatePillar, deletePillar,
    promotePillar, uploadPillarImage
} from '../controllers/coreVisionController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.get('/pillars', getPillars);

// Protected
router.use(verifyToken);
router.post('/pillars', createPillar);
router.put('/pillars/:id', updatePillar);
router.delete('/pillars/:id', deletePillar);
router.put('/pillars/:id/promote', promotePillar);
router.post('/pillars/upload', uploadPillarImage);

export default router;
