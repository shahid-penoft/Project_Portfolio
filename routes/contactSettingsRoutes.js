import express from 'express';
import { getContactSettings, updateContactSettings } from '../controllers/contactSettingsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', getContactSettings);
router.put('/', verifyToken, requirePermission('site_settings'), updateContactSettings);

export default router;
