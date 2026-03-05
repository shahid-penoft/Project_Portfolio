
import express from 'express';
import { getPeople, getPersonById, deletePerson, createPerson, updatePerson } from '../controllers/peopleController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Apply auth to all admin people routes
router.use(verifyToken);

router.get('/', getPeople);
router.get('/:id', getPersonById);
router.post('/', createPerson);
router.put('/:id', updatePerson);
router.delete('/:id', deletePerson);

export default router;
