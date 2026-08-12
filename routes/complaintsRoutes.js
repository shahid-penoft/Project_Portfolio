import express from 'express';
import { dualAuth, adminOnly, optionalDualAuth } from '../middlewares/dualAuthMiddleware.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadComplaintMedia, uploadComplaintAttachments , uploadComplaintUpdateFiles } from '../configs/multerS3.js';
import {
    getComplaints,
    getComplaintStats,
    getComplaintById,
    createComplaint,
    updateComplaint,
    updateComplaintStatus,
    trashComplaint,
    restoreComplaint,
    deleteComplaint,
    addComplaintUpdate,
    editComplaintUpdate,
    deleteComplaintUpdate,
    uploadComplaintMedia as uploadMedia,
    deleteComplaintMedia,
    uploadComplaintAttachment,
    deleteComplaintAttachment,
    addComplaintTeamMember,
    removeComplaintTeamMember,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getNextId,
} from '../controllers/complaintsController.js';

const router = express.Router();

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', verifyToken, getComplaintStats);

// ── Categories ─────────────────────────────────────────────────
router.get('/categories', getCategories); // public or dualAuth
router.post('/categories', verifyToken, createCategory);
router.put('/categories/:id', verifyToken, updateCategory);
router.delete('/categories/:id', verifyToken, deleteCategory);

// ── List & Create (admin, constituent, or public intake) ───────
router.get('/next-id', dualAuth, getNextId);
router.get('/',    dualAuth, getComplaints);
router.get('/:id', dualAuth, getComplaintById);
router.post('/',   optionalDualAuth, createComplaint);

// ── Admin-only mutations ───────────────────────────────────────
router.patch('/:id',          verifyToken, updateComplaint);
router.patch('/:id/status',   verifyToken, updateComplaintStatus);
router.patch('/:id/trash',    verifyToken, trashComplaint);
router.patch('/:id/restore',  verifyToken, restoreComplaint);
router.delete('/:id',         verifyToken, deleteComplaint); // requires ?force=true

// ── Updates sub-resource ───────────────────────────────────────
router.post('/:id/updates',
    verifyToken,
    (req, res, next) => uploadComplaintUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    addComplaintUpdate
);
router.patch('/:id/updates/:updateId',
    verifyToken,
    (req, res, next) => uploadComplaintUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    editComplaintUpdate
);
router.delete('/:id/updates/:updateId',   verifyToken, deleteComplaintUpdate);

// ── Media sub-resource (upload: admin or owner; delete: admin) ─
router.post(
    '/:id/media',
    optionalDualAuth,
    (req, res, next) => uploadComplaintMedia(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadMedia
);
router.delete('/:id/media/:mediaId', verifyToken, deleteComplaintMedia);

// ── Attachments sub-resource ───────────────────────────────────
router.post(
    '/:id/attachments',
    optionalDualAuth,
    (req, res, next) => uploadComplaintAttachments(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadComplaintAttachment
);
router.delete('/:id/attachments/:attachId', verifyToken, deleteComplaintAttachment);

// ── Team sub-resource (admin only) ────────────────────────────
router.post('/:id/team',              verifyToken, addComplaintTeamMember);
router.delete('/:id/team/:memberId',  verifyToken, removeComplaintTeamMember);

export default router;
