import express from 'express';
import { dualAuth, adminOnly, optionalDualAuth } from '../middlewares/dualAuthMiddleware.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadSuggestionMediaS3 as uploadSuggestionMedia, uploadSuggestionAttachmentsS3 as uploadSuggestionAttachments, uploadSuggestionUpdateFiles } from '../configs/multerS3.js';
import {
    getSuggestions,
    getSuggestionStats,
    getSuggestionById,
    createSuggestion,
    updateSuggestion,
    updateSuggestionStatus,
    trashSuggestion,
    restoreSuggestion,
    deleteSuggestion,
    addSuggestionUpdate,
    editSuggestionUpdate,
    deleteSuggestionUpdate,
    uploadSuggestionMedia as uploadMedia,
    deleteSuggestionMedia,
    uploadSuggestionAttachment,
    deleteSuggestionAttachment,
    addSuggestionTeamMember,
    removeSuggestionTeamMember,
    getNextId,
} from '../controllers/suggestionsController.js';

const router = express.Router();

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', verifyToken, getSuggestionStats);

// ── List & Create ──────────────────────────────────────────────
router.get('/next-id', dualAuth, getNextId);
router.get('/',    dualAuth, getSuggestions);
router.get('/:id', dualAuth, getSuggestionById);
router.post('/',   optionalDualAuth, createSuggestion);

// ── Admin-only mutations ───────────────────────────────────────
router.patch('/:id',          verifyToken, updateSuggestion);
router.patch('/:id/status',   verifyToken, updateSuggestionStatus);
router.patch('/:id/trash',    verifyToken, trashSuggestion);
router.patch('/:id/restore',  verifyToken, restoreSuggestion);
router.delete('/:id',         verifyToken, deleteSuggestion);

// ── Updates sub-resource ───────────────────────────────────────
router.post('/:id/updates',
    verifyToken,
    (req, res, next) => uploadSuggestionUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    addSuggestionUpdate
);
router.patch('/:id/updates/:updateId',
    verifyToken,
    (req, res, next) => uploadSuggestionUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    editSuggestionUpdate
);
router.delete('/:id/updates/:updateId', verifyToken, deleteSuggestionUpdate);

// ── Media ──────────────────────────────────────────────────────
router.post(
    '/:id/media',
    dualAuth,
    (req, res, next) => uploadSuggestionMedia(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadMedia
);
router.delete('/:id/media/:mediaId', verifyToken, deleteSuggestionMedia);

// ── Attachments ────────────────────────────────────────────────
router.post(
    '/:id/attachments',
    optionalDualAuth,
    (req, res, next) => uploadSuggestionAttachments(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadSuggestionAttachment
);
router.delete('/:id/attachments/:attachId', verifyToken, deleteSuggestionAttachment);

// ── Team ───────────────────────────────────────────────────────
router.post('/:id/team',             verifyToken, addSuggestionTeamMember);
router.delete('/:id/team/:memberId', verifyToken, removeSuggestionTeamMember);

export default router;
