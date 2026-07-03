import express from 'express';
import { dualAuth, adminOnly } from '../middlewares/dualAuthMiddleware.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { uploadIdeaMediaS3, uploadIdeaAttachmentsS3 , uploadIdeaUpdateFiles } from '../configs/multerS3.js';
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
    deleteIdeaUpdate,
    uploadIdeaMedia,
    deleteIdeaMedia,
    uploadIdeaAttachment,
    deleteIdeaAttachment,
    addIdeaTeamMember,
    removeIdeaTeamMember,
    getIdeaCategories,
} from '../controllers/ideasController.js';

const router = express.Router();

// ── Stats (admin only) ─────────────────────────────────────────
router.get('/stats', verifyToken, requirePermission('ideas'), getIdeaStats);

// ── Categories ─────────────────────────────────────────────────
router.get('/categories', getIdeaCategories);

// ── List & Create (admin or authenticated constituent) ─────────
router.get('/',    dualAuth, getIdeas);
router.get('/:id', dualAuth, getIdeaById);
router.post('/',   dualAuth, createIdea);

// ── Admin-only mutations ───────────────────────────────────────
router.patch('/:id',          verifyToken, requirePermission('ideas'), updateIdea);
router.patch('/:id/status',   verifyToken, requirePermission('ideas'), updateIdeaStatus);
router.patch('/:id/trash',    verifyToken, requirePermission('ideas'), trashIdea);
router.patch('/:id/restore',  verifyToken, requirePermission('ideas'), restoreIdea);
router.delete('/:id',         verifyToken, requirePermission('ideas'), deleteIdea); // requires ?force=true

// ── Updates sub-resource ───────────────────────────────────────
router.post('/:id/updates',
    verifyToken,
    requirePermission('ideas'),
    (req, res, next) => uploadIdeaUpdateFiles(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    addIdeaUpdate
);
router.delete('/:id/updates/:updateId',   verifyToken, requirePermission('ideas'), deleteIdeaUpdate);

// ── Media sub-resource (upload: admin or owner; delete: admin) ─
router.post(
    '/:id/media',
    dualAuth,
    (req, res, next) => uploadIdeaMediaS3(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadIdeaMedia
);
router.delete('/:id/media/:mediaId', verifyToken, requirePermission('ideas'), deleteIdeaMedia);

// ── Attachments sub-resource ───────────────────────────────────
router.post(
    '/:id/attachments',
    dualAuth,
    (req, res, next) => uploadIdeaAttachmentsS3(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        next();
    }),
    uploadIdeaAttachment
);
router.delete('/:id/attachments/:attachId', verifyToken, requirePermission('ideas'), deleteIdeaAttachment);

// ── Team sub-resource (admin only) ────────────────────────────
router.post('/:id/team',              verifyToken, requirePermission('ideas'), addIdeaTeamMember);
router.delete('/:id/team/:memberId',  verifyToken, requirePermission('ideas'), removeIdeaTeamMember);

export default router;
