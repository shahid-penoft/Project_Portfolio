import express from 'express';
import { dualAuth, adminOnly } from '../middlewares/dualAuthMiddleware.js';
import { verifyToken } from '../middlewares/auth.js';
import { uploadComplaintMedia, uploadComplaintAttachments } from '../configs/multerS3.js';
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
} from '../controllers/complaintsController.js';

const router = express.Router();

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', verifyToken, getComplaintStats);

// ── Categories ─────────────────────────────────────────────────
router.get('/categories', getCategories); // public or dualAuth
router.post('/categories', verifyToken, createCategory);
router.put('/categories/:id', verifyToken, updateCategory);
router.delete('/categories/:id', verifyToken, deleteCategory);

// ── List & Create (admin or authenticated constituent) ─────────
router.get('/',    dualAuth, getComplaints);
router.get('/:id', dualAuth, getComplaintById);
router.post('/',   dualAuth, createComplaint);

// ── Admin-only mutations ───────────────────────────────────────
router.patch('/:id',          verifyToken, updateComplaint);
router.patch('/:id/status',   verifyToken, updateComplaintStatus);
router.patch('/:id/trash',    verifyToken, trashComplaint);
router.patch('/:id/restore',  verifyToken, restoreComplaint);
router.delete('/:id',         verifyToken, deleteComplaint); // requires ?force=true

// ── Updates sub-resource ───────────────────────────────────────
router.post('/:id/updates',               verifyToken, addComplaintUpdate);
router.delete('/:id/updates/:updateId',   verifyToken, deleteComplaintUpdate);

// ── Media sub-resource (upload: admin or owner; delete: admin) ─
router.post(
    '/:id/media',
    dualAuth,
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
    dualAuth,
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
