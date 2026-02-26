import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getWardsByLocalBody, createWard, updateWard, deleteWard } from '../controllers/wardController.js';

// Router is mounted at /api/local-bodies/:localBodyId/wards
const router = express.Router({ mergeParams: true });

router.get('/', getWardsByLocalBody); // public (or verifyToken depending on requirement, let's keep GET public like localBodies)

router.use(verifyToken);
router.post('/', createWard);
router.put('/:id', updateWard);
router.delete('/:id', deleteWard);

export default router;
