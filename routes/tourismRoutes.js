import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import * as ctrl from '../controllers/tourismController.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Public
router.get('/all', ctrl.getAttractions);
router.post('/suggest', apiLimiter, ctrl.submitSuggestion); // Constituent/Public submission

// Admin Specific Routes (Must be defined before /:slug)
router.post('/upload-image', verifyToken, ctrl.uploadTourismImage);
router.get('/admin/:id', verifyToken, ctrl.getAttractionById);

// Public - Detail by slug
router.get('/:slug', ctrl.getAttractionBySlug);

// Admin CRUD
router.post('/', verifyToken, ctrl.createAttraction);
router.put('/:id', verifyToken, ctrl.updateAttraction);
router.delete('/:id', verifyToken, ctrl.deleteAttraction);

export default router;
