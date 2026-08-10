import express from 'express';
import {
    getPillars, createPillar, updatePillar, deletePillar,
    promotePillar, uploadPillarImage, getSectionMeta, updateSectionMeta
} from '../controllers/coreVisionController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.get('/pillars', getPillars);
router.get('/section', getSectionMeta);

// Protected
router.use(verifyToken, requirePermission('about'));
router.post('/pillars', createPillar);
router.put('/pillars/:id', updatePillar);
router.delete('/pillars/:id', deletePillar);
router.put('/pillars/:id/promote', promotePillar);
router.post('/pillars/upload', uploadPillarImage);
router.put('/section', updateSectionMeta);

export default router;
