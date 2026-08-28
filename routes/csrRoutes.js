import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import {
    getCSRStats,
    getCSROrganisations,
    getCSROrganisationById,
    createCSROrganisation,
    updateCSROrganisation,
    softDeleteCSROrganisation,
    getCSRTrash,
    restoreCSROrganisation,
    permanentDeleteCSROrganisation,
    logCSRCall,
    logCSREmail,
    getCSRFollowups,
    createCSRFollowup,
    getCSRActivities,
    createCSRActivity,
    getCSRReports,
    getCSRReportById,
    createCSRReport,
    updateCSRReport,
    deleteCSRReport,
    uploadCSRDocument,
} from '../controllers/csrController.js';
import {
    getCSROrgProjects,
    linkCSROrgProject,
    updateCSROrgProjectLink,
    removeCSROrgProjectLink,
} from '../controllers/csrProjectsController.js';

const router = express.Router();

// All CSR routes require authentication + 'csr' permission
router.use(verifyToken, requirePermission('csr'));

// ── Upload ────────────────────────────────────────────────────
router.post('/upload', uploadCSRDocument);

// ── Stats ─────────────────────────────────────────────────────
router.get('/stats', getCSRStats);

// ── Organisations ─────────────────────────────────────────────
router.get('/organisations',            getCSROrganisations);
router.post('/organisations',           createCSROrganisation);
router.get('/organisations/:id',        getCSROrganisationById);
router.put('/organisations/:id',        updateCSROrganisation);
router.delete('/organisations/:id',     softDeleteCSROrganisation);

// Organisation actions
router.post('/organisations/:id/restore',   restoreCSROrganisation);
router.delete('/organisations/:id/permanent', permanentDeleteCSROrganisation);
router.post('/organisations/:id/log-call',   logCSRCall);
router.post('/organisations/:id/log-email',  logCSREmail);

// CSR ↔ Projects bridge
router.get('/organisations/:id/projects',              getCSROrgProjects);
router.post('/organisations/:id/projects',             linkCSROrgProject);
router.patch('/organisations/:id/projects/:linkId',    updateCSROrgProjectLink);
router.delete('/organisations/:id/projects/:linkId',   removeCSROrgProjectLink);

// ── Trash ─────────────────────────────────────────────────────
router.get('/trash', getCSRTrash);

// ── Followups ─────────────────────────────────────────────────
router.get('/followups',  getCSRFollowups);
router.post('/followups', createCSRFollowup);

// ── Activities ────────────────────────────────────────────────
router.get('/activities',  getCSRActivities);
router.post('/activities', createCSRActivity);

// ── Reports ───────────────────────────────────────────────────
router.get('/reports',      getCSRReports);
router.post('/reports',     createCSRReport);
router.get('/reports/:id',  getCSRReportById);
router.put('/reports/:id',  updateCSRReport);
router.delete('/reports/:id', deleteCSRReport);

export default router;
