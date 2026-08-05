import express from 'express';
import { dualAuth, adminOnly, optionalDualAuth } from '../middlewares/dualAuthMiddleware.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadIdeaMediaS3 as uploadIdeaMedia, uploadIdeaAttachmentsS3 as uploadIdeaAttachments, uploadIdeaUpdateFiles } from '../configs/multerS3.js';
import {
    getIdeas,
    getIdeaStats,
    getIdeaById,
    createIdea,
    updateIdea,
    updateIdeaStatus,
    trashIdea,
    restoreIdea,
    deleteIdea,
    addIdeaUpdate,
    editIdeaUpdate,
    deleteIdeaUpdate,
    uploadIdeaMedia as uploadMedia,
    deleteIdeaMedia,
    uploadIdeaAttachment,
    deleteIdeaAttachment,
    addIdeaTeamMember,
    removeIdeaTeamMember,
    getNextId,
} from '../controllers/ideasController.js';

const router = express.Router();

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', verifyToken, getIdeaStats);

// ── List & Create ──────────────────────────────────────────────
router.get('/next-id', dualAuth, getNextId);
router.get('/',    dualAuth, getIdeas);
router.get('/:id', dualAuth, getIdeaById);
router.post('/',   optionalDualAuth, createIdea);

// ── Admin-only mutations ───────────────────────────────────────
router.patch('/:id',          verifyToken, updateIdea);
router.patch('/:id/status',   verifyToken, updateIdeaStatus);
router.patch('/:id/trash',    verifyToken, trashIdea);
router.patch('/:id/restore',  verifyToken, restoreIdea);
router.delete('/:id',         verifyToken, deleteIdea);

// ── Updates sub-resource ───────────────────────────────────────
router.post('/:id/updates',
    verifyToken,
    (req, res, next) => uploadIdeaUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    addIdeaUpdate
);
router.patch('/:id/updates/:updateId',
    verifyToken,
    (req, res, next) => uploadIdeaUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    editIdeaUpdate
);
router.delete('/:id/updates/:updateId', verifyToken, deleteIdeaUpdate);

// ── Media ──────────────────────────────────────────────────────
router.post(
    '/:id/media',
    dualAuth,
    (req, res, next) => uploadIdeaMedia(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadMedia
);
router.delete('/:id/media/:mediaId', verifyToken, deleteIdeaMedia);

// ── Attachments ────────────────────────────────────────────────
router.post(
    '/:id/attachments',
    optionalDualAuth,
    (req, res, next) => uploadIdeaAttachments(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadIdeaAttachment
);
router.delete('/:id/attachments/:attachId', verifyToken, deleteIdeaAttachment);

// ── Team ───────────────────────────────────────────────────────
router.post('/:id/team',             verifyToken, addIdeaTeamMember);
router.delete('/:id/team/:memberId', verifyToken, removeIdeaTeamMember);

export default router;
