import express from 'express';
import {
    getTestimonials, getTestimonialById,
    createTestimonial, updateTestimonial,
    deleteTestimonial, promoteTestimonial,
    uploadTestimonialMedia, uploadTestimonialMediaPublic,
    createTestimonialRequest,
} from '../controllers/enteNaduTestimonialsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// Public
router.get('/', getTestimonials);
router.get('/:id', getTestimonialById);
router.post('/request', createTestimonialRequest);
router.post('/upload/public', uploadTestimonialMediaPublic);

// Protected
router.use(verifyToken, requirePermission('ente_nadu'));
router.post('/', createTestimonial);
router.put('/:id', updateTestimonial);
router.delete('/:id', deleteTestimonial);
router.put('/:id/promote', promoteTestimonial);
router.post('/upload', uploadTestimonialMedia);

export default router;
