import express from 'express';
import { getAllSettings, updateSettings, uploadManifestoPDF } from '../controllers/settingsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// Publicly readable
router.get('/', getAllSettings);

// Admin only update
router.patch('/', verifyToken, requirePermission('site_settings'), updateSettings);

// Admin only PDF upload
router.post('/manifesto-pdf', verifyToken, requirePermission('site_settings'), uploadManifestoPDF);

export default router;
