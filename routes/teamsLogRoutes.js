import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import {
    getTeamsLog,
    getTeamsLogEntry,
    exportTeamsLog,
    getTeamsLogMeta,
} from '../controllers/teamsLogController.js';

const router = express.Router();

// All routes require a valid admin session with site_settings permission
// (Superadmins bypass the permission check automatically)
router.use(verifyToken, requirePermission('site_settings'));

// ⚠️ /meta and /export MUST be declared BEFORE /:id
// otherwise Express treats the string "meta"/"export" as an id param.
router.get('/meta',   getTeamsLogMeta);
router.get('/export', exportTeamsLog);
router.get('/',       getTeamsLog);
router.get('/:id',   getTeamsLogEntry);

export default router;
