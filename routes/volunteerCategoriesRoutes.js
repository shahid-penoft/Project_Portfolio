import express from 'express';
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategoriesHandler,
} from '../controllers/volunteerCategoriesController.js';

const router = express.Router();

// GET /api/volunteer-categories - Public: fetch all categories ordered by sort_order
router.get('/', getCategories);

// PATCH /api/volunteer-categories/reorder - MUST be declared before /:id to avoid param collision
// Admin: batch-update sort_order from drag-and-drop
router.patch('/reorder', reorderCategoriesHandler);

// POST /api/volunteer-categories - Admin: create new activity category
router.post('/', createCategory);

// PUT /api/volunteer-categories/:id - Admin: update existing category
router.put('/:id', updateCategory);

// DELETE /api/volunteer-categories/:id - Admin: delete a category
router.delete('/:id', deleteCategory);

export default router;
