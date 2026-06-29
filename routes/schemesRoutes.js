import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { verifyConstituentToken } from '../middlewares/constituentAuth.js';
import * as ctrl from '../controllers/schemesController.js';

const router = express.Router();

// Public
router.get('/all', ctrl.getSchemes);

// Constituent Protected
router.get('/my-applications', verifyConstituentToken, ctrl.getMySchemeApplications);

// Admin Protected
router.get('/applications', verifyToken, ctrl.getAllSchemeApplications);
router.get('/applications/:appId', verifyToken, ctrl.getSchemeApplicationById);
router.patch('/applications/:appId/status', verifyToken, ctrl.updateSchemeApplicationStatus);

// Scheme By ID (needs to be below specific routes above)
router.get('/:id', ctrl.getSchemeById);

// Admin / Constituent combined
router.get('/:id/applications', verifyToken, ctrl.getSchemeApplicationsByScheme);
router.post('/:id/apply', verifyConstituentToken, ctrl.submitSchemeApplication); // Requires constituent authentication

// Admin CRUD
router.post('/', verifyToken, ctrl.createScheme);
router.put('/:id', verifyToken, ctrl.updateScheme);
router.delete('/:id', verifyToken, ctrl.deleteScheme);

export default router;
