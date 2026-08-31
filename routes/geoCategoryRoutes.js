import express from 'express';
import {
    getGeoCategories,
    createGeoCategory,
    updateGeoCategory,
    deleteGeoCategory
} from '../controllers/geoCategoryController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// Publicly readable categories
router.get('/', getGeoCategories);

// Admin only routes for managing categories
router.use(verifyToken);
router.use(requirePermission(['geo_mapping', 'geo-location', 'site_settings']));

router.post('/', createGeoCategory);
router.put('/:id', updateGeoCategory);
router.delete('/:id', deleteGeoCategory);

export default router;
