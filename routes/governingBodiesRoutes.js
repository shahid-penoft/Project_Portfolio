import express from 'express';
import {
    getGoverningBodies,
    getGoverningBodyById,
    createGoverningBody,
    updateGoverningBody,
    deleteGoverningBody,
    toggleBookmark
} from '../controllers/governingBodiesController.js';
import {
    getStaffsByOffice,
    createStaff,
    updateStaff,
    deleteStaff
} from '../controllers/governingBodyStaffsController.js';
import { verifyToken as checkAdmin } from '../middlewares/auth.js';

const router = express.Router();

// GET all governing bodies
router.get('/', checkAdmin, getGoverningBodies);

// GET a specific governing body by ID
router.get('/:id', checkAdmin, getGoverningBodyById);

// POST a new governing body
router.post('/', checkAdmin, createGoverningBody);

// PUT (update) an existing governing body
router.put('/:id', checkAdmin, updateGoverningBody);

// DELETE a governing body
router.delete('/:id', checkAdmin, deleteGoverningBody);

// PATCH toggle bookmark status
router.patch('/:id/bookmark', checkAdmin, toggleBookmark);

// Staffs Routes
router.get('/:officeId/staffs', checkAdmin, getStaffsByOffice);
router.post('/:officeId/staffs', checkAdmin, createStaff);
router.put('/staffs/:staffId', checkAdmin, updateStaff);
router.delete('/staffs/:staffId', checkAdmin, deleteStaff);

export default router;
