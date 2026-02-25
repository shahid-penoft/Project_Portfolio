import express from 'express';
import {
    getTestimonials, getTestimonialById,
    createTestimonial, updateTestimonial,
    deleteTestimonial, promoteTestimonial,
    uploadTestimonialMedia,
} from '../controllers/enteNaduTestimonialsController.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.get('/', getTestimonials);
router.get('/:id', getTestimonialById);

// Protected
router.use(verifyToken);
router.post('/', createTestimonial);
router.put('/:id', updateTestimonial);
router.delete('/:id', deleteTestimonial);
router.put('/:id/promote', promoteTestimonial);
router.post('/upload', uploadTestimonialMedia);

export default router;
