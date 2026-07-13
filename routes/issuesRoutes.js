import express from 'express';
import { dualAuth, adminOnly } from '../middlewares/dualAuthMiddleware.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadIssueMedia, uploadIssueAttachments , uploadIssueUpdateFiles } from '../configs/multerS3.js';
import {
    getIssues,
    getIssueStats,
    getIssueById,
    createIssue,
    updateIssue,
    updateIssueStatus,
    trashIssue,
    restoreIssue,
    deleteIssue,
    addIssueUpdate,
    deleteIssueUpdate,
    uploadIssueMedia as uploadMedia,
    deleteIssueMedia,
    uploadIssueAttachment,
    deleteIssueAttachment,
    addIssueTeamMember,
    removeIssueTeamMember,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getNextId,
} from '../controllers/issuesController.js';

const router = express.Router();

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', verifyToken, getIssueStats);

// ── Categories ─────────────────────────────────────────────────
router.get('/categories', getCategories); // public or dualAuth
router.post('/categories', verifyToken, createCategory);
router.put('/categories/:id', verifyToken, updateCategory);
router.delete('/categories/:id', verifyToken, deleteCategory);

// ── List & Create (admin or authenticated constituent) ─────────
router.get('/next-id', dualAuth, getNextId);
router.get('/',    dualAuth, getIssues);
router.get('/:id', dualAuth, getIssueById);
router.post('/',   dualAuth, createIssue);

// ── Admin-only mutations ───────────────────────────────────────
router.patch('/:id',          verifyToken, updateIssue);
router.patch('/:id/status',   verifyToken, updateIssueStatus);
router.patch('/:id/trash',    verifyToken, trashIssue);
router.patch('/:id/restore',  verifyToken, restoreIssue);
router.delete('/:id',         verifyToken, deleteIssue); // requires ?force=true

// ── Updates sub-resource ───────────────────────────────────────
router.post('/:id/updates',
    verifyToken,
    (req, res, next) => uploadIssueUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    addIssueUpdate
);
router.delete('/:id/updates/:updateId',   verifyToken, deleteIssueUpdate);

// ── Media sub-resource (upload: admin or owner; delete: admin) ─
router.post(
    '/:id/media',
    dualAuth,
    (req, res, next) => uploadIssueMedia(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadMedia
);
router.delete('/:id/media/:mediaId', verifyToken, deleteIssueMedia);

// ── Attachments sub-resource ───────────────────────────────────
router.post(
    '/:id/attachments',
    dualAuth,
    (req, res, next) => uploadIssueAttachments(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadIssueAttachment
);
router.delete('/:id/attachments/:attachId', verifyToken, deleteIssueAttachment);

// ── Team sub-resource (admin only) ────────────────────────────
router.post('/:id/team',              verifyToken, addIssueTeamMember);
router.delete('/:id/team/:memberId',  verifyToken, removeIssueTeamMember);

export default router;
