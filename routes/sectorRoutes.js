import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getAllSectors, createSector, updateSector, deleteSector } from '../controllers/sectorController.js';

const router = express.Router();

router.get('/', getAllSectors); // public

router.use(verifyToken);
router.post('/', createSector);
router.put('/:id', updateSector);
router.delete('/:id', deleteSector);

export default router;
