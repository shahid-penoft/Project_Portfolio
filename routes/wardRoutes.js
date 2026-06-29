import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { getWardsByLocalBody, createWard, updateWard, deleteWard } from '../controllers/wardController.js';

// Router is mounted at /api/local-bodies/:localBodyId/wards
const router = express.Router({ mergeParams: true });

router.get('/', getWardsByLocalBody);

router.use(verifyToken, requirePermission('enquiries'));
router.post('/', createWard);
router.put('/:id', updateWard);
router.delete('/:id', deleteWard);

export default router;
