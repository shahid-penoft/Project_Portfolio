import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import {
    getDropdowns,
    getDropdownById,
    createDropdown,
    updateDropdown,
    reorderDropdowns,
    deleteDropdown,
    toggleDropdownStatus,
    getDropdownImpact,
} from '../controllers/mlaDropdownsController.js';

const router = express.Router();

// ── Public / Form consumption ──────────────────────────────────
// GET /api/mla/dropdowns?key=complaint_priority  → options for a field (forms, filter panels)
// GET /api/mla/dropdowns?module=Complaints        → all entries for a module
// GET /api/mla/dropdowns                          → full list (admin manager)
router.get('/', getDropdowns);

// Impact count (public read — no admin token required for forms)
router.get('/impact', getDropdownImpact);

// ── Admin CRUD (protected) ─────────────────────────────────────
router.get('/:id',              verifyToken, getDropdownById);
router.post('/',                verifyToken, createDropdown);
router.put('/reorder',          verifyToken, reorderDropdowns);
router.put('/:id',              verifyToken, updateDropdown);
router.patch('/:id/toggle',     verifyToken, toggleDropdownStatus);
router.delete('/:id',           verifyToken, deleteDropdown);

export default router;
