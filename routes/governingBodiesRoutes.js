import express from 'express';
import {
    getGoverningBodies,
    getGoverningBodyById,
    getGoverningBodyStats,
    createGoverningBody,
    updateGoverningBody,
    deleteGoverningBody,
    toggleBookmark,
    trashGoverningBody,
    restoreGoverningBody,
    checkWardUniqueness,
} from '../controllers/governingBodiesController.js';
import {
    getStaffsByOffice,
    createStaff,
    updateStaff,
    deleteStaff
} from '../controllers/governingBodyStaffsController.js';
import { verifyToken as checkAdmin } from '../middlewares/auth.js';

const router = express.Router();

// GET all governing bodies (supports ?trash=true for trash view)
router.get('/', checkAdmin, getGoverningBodies);

// GET stats: staff member counts per office (MUST be before /:id)
router.get('/stats', checkAdmin, getGoverningBodyStats);

// GET check if a ward is already occupied by a member
router.get('/check-ward/:wardId', checkAdmin, checkWardUniqueness);

// GET a specific governing body by ID
router.get('/:id', checkAdmin, getGoverningBodyById);

// POST a new governing body
router.post('/', checkAdmin, createGoverningBody);

// PUT (update) an existing governing body
router.put('/:id', checkAdmin, updateGoverningBody);

// DELETE a governing body (permanent — requires ?force=true)
router.delete('/:id', checkAdmin, deleteGoverningBody);

// PATCH toggle bookmark status
router.patch('/:id/bookmark', checkAdmin, toggleBookmark);

// PATCH soft-delete (move to trash)
router.patch('/:id/trash', checkAdmin, trashGoverningBody);

// PATCH restore from trash
router.patch('/:id/restore', checkAdmin, restoreGoverningBody);

// Staffs Routes
router.get('/:officeId/staffs', checkAdmin, getStaffsByOffice);
router.post('/:officeId/staffs', checkAdmin, createStaff);
router.put('/staffs/:staffId', checkAdmin, updateStaff);
router.delete('/staffs/:staffId', checkAdmin, deleteStaff);

export default router;
