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
  downloadPdf
} from '../controllers/cmFundsController.js';

import {
  listDocumentTypes,
  createDocumentType,
  updateDocumentType,
  toggleDocumentStatus,
  deleteDocumentType,
  listCategories,
  addCategory,
  removeCategory,
  getCategoryConfig,
  saveCategoryConfig,
  addDocToCategory,
  removeDocFromCategory,
  toggleDocRequirement
} from '../controllers/cmFundsChecklistsController.js';

const router = express.Router();

// Apply admin authentication to all CM Funds routes
router.use(adminAuth);

// ==========================================
// Applications (Requests)
// ==========================================
router.post('/draft', createDraftRequest);         // ← Quick-add draft (minimal fields)
router.get('/requests', listRequests);
router.post('/requests', uploadCMFundDocsS3, createRequest);

router.get('/requests/:id', getRequest);
router.put('/requests/:id', uploadCMFundDocsS3, updateRequest);
router.patch('/requests/:id/status', updateStatus);
router.delete('/requests/:id', deleteRequest);
router.get('/requests/:id/pdf', downloadPdf);

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
router.delete('/categories/:id', removeCategory);

router.get('/categories/:id/config', getCategoryConfig);
router.put('/categories/:id/config', saveCategoryConfig);
router.post('/categories/:id/config', addDocToCategory);
router.delete('/categories/:categoryId/config/:docId', removeDocFromCategory);
router.patch('/categories/:categoryId/config/:docId', toggleDocRequirement);

export default router;
