import express from 'express';
import { dualAuth, adminOnly } from '../middlewares/dualAuthMiddleware.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadSuggestionMediaS3, uploadSuggestionAttachmentsS3 } from '../configs/multerS3.js';
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
    deleteSuggestionUpdate,
    uploadSuggestionMedia,
    deleteSuggestionMedia,
    uploadSuggestionAttachment,
    deleteSuggestionAttachment,
    addSuggestionTeamMember,
    removeSuggestionTeamMember,
    getSuggestionCategories,
} from '../controllers/suggestionsController.js';

const router = express.Router();

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', verifyToken, requirePermission('suggestions'), getSuggestionStats);

// ── Categories ─────────────────────────────────────────────────
router.get('/categories', getSuggestionCategories);

// ── List & Create (admin or authenticated constituent) ─────────
router.get('/',    dualAuth, getSuggestions);
router.get('/:id', dualAuth, getSuggestionById);
router.post('/',   dualAuth, createSuggestion);

// ── Admin-only mutations ───────────────────────────────────────
router.patch('/:id',          verifyToken, requirePermission('suggestions'), updateSuggestion);
router.patch('/:id/status',   verifyToken, requirePermission('suggestions'), updateSuggestionStatus);
router.patch('/:id/trash',    verifyToken, requirePermission('suggestions'), trashSuggestion);
router.patch('/:id/restore',  verifyToken, requirePermission('suggestions'), restoreSuggestion);
router.delete('/:id',         verifyToken, requirePermission('suggestions'), deleteSuggestion); // requires ?force=true

// ── Updates sub-resource ───────────────────────────────────────
router.post('/:id/updates',               verifyToken, requirePermission('suggestions'), addSuggestionUpdate);
router.delete('/:id/updates/:updateId',   verifyToken, requirePermission('suggestions'), deleteSuggestionUpdate);

// ── Media sub-resource (upload: admin or owner; delete: admin) ─
router.post(
    '/:id/media',
    dualAuth,
    (req, res, next) => uploadSuggestionMediaS3(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadSuggestionMedia
);
router.delete('/:id/media/:mediaId', verifyToken, requirePermission('suggestions'), deleteSuggestionMedia);

// ── Attachments sub-resource ───────────────────────────────────
router.post(
    '/:id/attachments',
    dualAuth,
    (req, res, next) => uploadSuggestionAttachmentsS3(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadSuggestionAttachment
);
router.delete('/:id/attachments/:attachId', verifyToken, requirePermission('suggestions'), deleteSuggestionAttachment);

// ── Team sub-resource (admin only) ────────────────────────────
router.post('/:id/team',              verifyToken, requirePermission('suggestions'), addSuggestionTeamMember);
router.delete('/:id/team/:memberId',  verifyToken, requirePermission('suggestions'), removeSuggestionTeamMember);

export default router;
