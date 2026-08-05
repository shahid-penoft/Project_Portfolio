import express from 'express';
import { verifyToken as adminAuth } from '../middlewares/auth.js';
import { uploadCMFundDocsS3 } from '../configs/multerS3.js';

import {
  listRequests,
  createRequest,
  createDraftRequest,
  getRequest,
  updateRequest,
  updateStatus,
  deleteRequest,
  restoreRequest,
  permanentDeleteRequest,
  downloadPdf,
  addUpdate,
  editUpdate,
  deleteUpdate,
  getNextAppId
} from '../controllers/cmFundsController.js';

import {
  listDocumentTypes,
  createDocumentType,
  updateDocumentType,
  toggleDocumentStatus,
  deleteDocumentType,
  listCategories,
  addCategory,
  updateCategory,
  removeCategory,
  getCategoryConfig,
  saveCategoryConfig,
  addDocToCategory,
  removeDocFromCategory,
  toggleDocRequirement
} from '../controllers/cmFundsChecklistsController.js';

import { optionalDualAuth } from '../middlewares/dualAuthMiddleware.js';

const router = express.Router();

const handleCMFundUpload = (req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    uploadCMFundDocsS3(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  } else {
    next();
  }
};

// ==========================================
// Public Submission (no admin token required)
// ==========================================
router.post('/public-submit', optionalDualAuth, handleCMFundUpload, createRequest);

// Apply admin authentication to remaining CM Funds routes
router.use(adminAuth);

// ==========================================
// Applications (Requests)
// ==========================================
router.post('/draft', uploadCMFundDocsS3, createDraftRequest);         // ← Quick-add draft (minimal fields)
router.get('/next-id', getNextAppId);
router.get('/requests', listRequests);
router.post('/requests', uploadCMFundDocsS3, createRequest);

router.get('/requests/:id', getRequest);
router.put('/requests/:id', uploadCMFundDocsS3, updateRequest);
router.patch('/requests/:id/status', updateStatus);
router.delete('/requests/:id', deleteRequest);                       // ← soft-delete (move to trash)
router.patch('/requests/:id/restore', restoreRequest);               // ← restore from trash
router.delete('/requests/:id/permanent', permanentDeleteRequest);    // ← hard-delete from trash
router.get('/requests/:id/pdf', downloadPdf);
router.post('/requests/:id/updates', uploadCMFundDocsS3, addUpdate);
router.patch('/requests/:id/updates/:updateId', uploadCMFundDocsS3, editUpdate);
router.delete('/requests/:id/updates/:updateId', deleteUpdate);

// ==========================================
// Document Master (Checklists)
// ==========================================
router.get('/documents', listDocumentTypes);
router.post('/documents', createDocumentType);
router.put('/documents/:id', updateDocumentType);
router.patch('/documents/:id/status', toggleDocumentStatus);
router.delete('/documents/:id', deleteDocumentType);

// ==========================================
// Categories & Configs
// ==========================================
router.get('/categories', listCategories);
router.post('/categories', addCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', removeCategory);

router.get('/categories/:id/config', getCategoryConfig);
router.put('/categories/:id/config', saveCategoryConfig);
router.post('/categories/:id/config', addDocToCategory);
router.delete('/categories/:categoryId/config/:docId', removeDocFromCategory);
router.patch('/categories/:categoryId/config/:docId', toggleDocRequirement);

export default router;
