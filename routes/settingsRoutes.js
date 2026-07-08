import express from 'express';
import { getAllSettings, updateSettings, uploadManifestoPDF, uploadSettingImage } from '../controllers/settingsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

// Publicly readable
router.get('/', getAllSettings);

// Admin only update
router.patch('/', verifyToken, requirePermission('site_settings'), updateSettings);

// Admin only PDF upload
router.post('/manifesto-pdf', verifyToken, requirePermission('site_settings'), uploadManifestoPDF);
// Admin only image upload (for templates, logos, etc.)
router.post('/upload-image', verifyToken, requirePermission('site_settings'), uploadSettingImage);

export default router;
