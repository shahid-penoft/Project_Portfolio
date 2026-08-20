import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    getTrashProjects,
    trashProject,
    restoreProject,
    permanentDeleteProject,
    bulkRestoreProjects,
    bulkPermanentDeleteProjects,
    uploadProjectImage,
    uploadProjectVideo,
    uploadProjectInlineImage,
    getProjectsByYear,
    getProjectsByLocalBody,
    getProjectsBySector,
    searchPublicProjects,
    getProjectBySlug,
    getProjectsBySectorName
} from '../controllers/projectController.js';

import { getMilestones, addMilestone, updateMilestone, deleteMilestone } from '../controllers/projectMilestonesController.js';
import { getUpdates, addUpdate, deleteUpdate, deleteUpdateMedia, updateUpdate } from '../controllers/projectUpdatesController.js';
import { getAttachments, addAttachment, deleteAttachment } from '../controllers/projectAttachmentsController.js';
import { getBudgetEntries, addBudgetEntry, deleteBudgetEntry, addBudgetAllocation, deleteBudgetAllocation } from '../controllers/projectBudgetController.js';
import { getContractors, addContractor, updateContractor, deleteContractor } from '../controllers/projectContractorsController.js';
import { getTeamMembers, addTeamMember, removeTeamMember } from '../controllers/projectTeamController.js';
import { getActivityLogs, addActivityLog } from '../controllers/projectActivityController.js';
import { getProjectCSRFunders } from '../controllers/csrProjectsController.js';

const router = express.Router();

// Public routes (must be defined before verifyToken)
router.get('/public/slug/:slug', (req, res, next) => { console.log('DEBUG: Hit public slug route'); next(); }, getProjectBySlug);
router.get('/slug/:slug', (req, res, next) => { console.log('DEBUG: Hit shortened slug route'); next(); }, getProjectBySlug);
router.get('/public', getAllProjects);
router.get('/public/search', searchPublicProjects);
router.get('/public/:id', getProjectById);
router.get('/public/year/:year', getProjectsByYear);
router.get('/public/local-body/:id', getProjectsByLocalBody);
router.get('/public/sector/:id', getProjectsBySector);
router.get('/public/sector-name/:sectorName', getProjectsBySectorName);

// All project routes are protected (admin only)
router.use(verifyToken, requirePermission('projects'));

router.post('/upload', uploadProjectImage);
router.post('/upload-video', uploadProjectVideo);
router.post('/:id/upload-inline-image', uploadProjectInlineImage);

// ── Trash Routes (must be before /:id) ──
router.get('/trash', getTrashProjects);
router.post('/trash/bulk-restore', bulkRestoreProjects);
router.post('/trash/bulk-delete', bulkPermanentDeleteProjects);

router.get('/all', getAllProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.patch('/:id/trash', trashProject);
router.patch('/:id/restore', restoreProject);
router.delete('/:id/permanent', permanentDeleteProject);

// ── Sub-entities ───────────────────────────────────────────────
// Milestones
router.get('/:id/milestones', getMilestones);
router.post('/:id/milestones', addMilestone);
router.put('/:id/milestones/:mid', updateMilestone);
router.delete('/:id/milestones/:mid', deleteMilestone);

// Updates
router.get('/:id/updates', getUpdates);
router.post('/:id/updates', addUpdate);
router.put('/:id/updates/:uid', updateUpdate);
router.delete('/:id/updates/:uid', deleteUpdate);
router.delete('/:id/updates/:uid/media/:mid', deleteUpdateMedia);

// Attachments
router.get('/:id/attachments', getAttachments);
router.post('/:id/attachments', addAttachment);
router.delete('/:id/attachments/:aid', deleteAttachment);

// Budget Entries
router.get('/:id/budget', getBudgetEntries);
router.post('/:id/budget', addBudgetEntry);
router.delete('/:id/budget/:bid', deleteBudgetEntry);

// Budget Allocations
router.post('/:id/budget/allocations', addBudgetAllocation);
router.delete('/:id/budget/allocations/:aid', deleteBudgetAllocation);

// Contractors
router.get('/:id/contractors', getContractors);
router.post('/:id/contractors', addContractor);
router.put('/:id/contractors/:cid', updateContractor);
router.delete('/:id/contractors/:cid', deleteContractor);

// Team Members
router.get('/:id/team', getTeamMembers);
router.post('/:id/team', addTeamMember);
router.delete('/:id/team/:uid', removeTeamMember);

// Activity Logs
router.get('/:id/activity', getActivityLogs);
router.post('/:id/activity', addActivityLog);

// CSR Funders (inverse view)
router.get('/:id/csr-funders', getProjectCSRFunders);

export default router;
