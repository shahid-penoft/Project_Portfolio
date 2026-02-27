import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getAllSectors, createSector, updateSector, deleteSector, uploadSectorImage } from '../controllers/sectorController.js';

const router = express.Router();

router.get('/', getAllSectors); // public

router.use(verifyToken);
router.post('/upload', uploadSectorImage);
router.post('/', createSector);
router.put('/:id', updateSector);
router.delete('/:id', deleteSector);

export default router;
