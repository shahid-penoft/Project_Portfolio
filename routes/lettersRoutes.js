import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import {
    getAllLetters,
    getNextLetterId,
    getLetterById,
    createLetter,
    updateLetter,
    deleteLetter,
    patchLetterStatus,
    patchResponseStatus,
    sendLetterEmail,
    downloadLetterPdf,
    getLetterActivity,
    getFollowups,
    createFollowup,
    updateFollowup,
    deleteFollowup,
} from '../controllers/lettersController.js';

const router = express.Router();

// All routes require admin auth
router.use(verifyToken);

import { uploadLetterAttachmentsS3 } from '../configs/multerS3.js';

// ── Letters ────────────────────────────────────────────────────
router.get('/next-id',          getNextLetterId);   // must be before /:id
router.get('/',                 getAllLetters);
router.post('/',                uploadLetterAttachmentsS3, createLetter);
router.get('/:id',              getLetterById);
router.put('/:id',              uploadLetterAttachmentsS3, updateLetter);
router.delete('/:id',           deleteLetter);
router.patch('/:id/status',     patchLetterStatus);
router.patch('/:id/response-status', patchResponseStatus);
router.post('/:id/send-email',  sendLetterEmail);
router.get('/:id/pdf',          downloadLetterPdf);

// ── Activity ───────────────────────────────────────────────────
router.get('/:id/activity',     getLetterActivity);

// ── Follow-ups ─────────────────────────────────────────────────
router.get('/:id/followups',         getFollowups);
router.post('/:id/followups',        createFollowup);
router.patch('/:id/followups/:fid',  updateFollowup);
router.delete('/:id/followups/:fid', deleteFollowup);

export default router;
