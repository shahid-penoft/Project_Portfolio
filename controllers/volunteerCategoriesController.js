import {
    fetchAllCategories,
    fetchCategoryById,
    insertCategory,
    updateCategoryById,
    deleteCategoryById,
    reorderCategories,
} from '../models/volunteerCategoryModel.js';

/**
 * GET /api/volunteer-categories
 * Public endpoint — returns all categories ordered by sort_order.
 */
export const getCategories = async (req, res) => {
    try {
        const categories = await fetchAllCategories();
        return res.json({ success: true, data: categories });
    } catch (err) {
        console.error('[getCategories error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve volunteer categories.',
        });
    }
};

/**
 * POST /api/volunteer-categories
 * Create a new volunteer activity category.
 */
export const createCategory = async (req, res) => {
    try {
        const { title, sector, desc, iconName, colorTheme } = req.body || {};

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Category title is required.' });
        }
        if (!desc || !desc.trim()) {
            return res.status(400).json({ success: false, message: 'Category description is required.' });
        }
        if (desc.length > 150) {
            return res.status(400).json({ success: false, message: 'Description must not exceed 150 characters.' });
        }

        const newCategory = await insertCategory({
            title:      title.trim(),
            sector:     (sector     || 'Health & Medical').trim(),
            desc:       desc.trim(),
            iconName:   iconName    || 'Users',
            colorTheme: colorTheme  || 'purple',
        });

        return res.status(201).json({
            success: true,
            message: 'Volunteer category added successfully.',
            data: newCategory,
        });
    } catch (err) {
        console.error('[createCategory error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to create volunteer category.',
        });
    }
};

/**
 * PUT /api/volunteer-categories/:id
 * Update an existing volunteer category (partial update).
 */
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await fetchCategoryById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Volunteer category not found.' });
        }

        const { title, sector, desc, iconName, colorTheme } = req.body || {};

        if (desc !== undefined && desc.length > 150) {
            return res.status(400).json({ success: false, message: 'Description must not exceed 150 characters.' });
        }

        const updated = await updateCategoryById(id, {
            title:      title      !== undefined ? title.trim()      : undefined,
            sector:     sector     !== undefined ? sector.trim()     : undefined,
            desc:       desc       !== undefined ? desc.trim()       : undefined,
            iconName:   iconName   !== undefined ? iconName          : undefined,
            colorTheme: colorTheme !== undefined ? colorTheme        : undefined,
        });

        return res.json({
            success: true,
            message: 'Volunteer category updated successfully.',
            data: updated,
        });
    } catch (err) {
        console.error('[updateCategory error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update volunteer category.',
        });
    }
};

/**
 * DELETE /api/volunteer-categories/:id
 */
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await fetchCategoryById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Volunteer category not found.' });
        }
        await deleteCategoryById(id);
        return res.json({ success: true, message: 'Volunteer category deleted.' });
    } catch (err) {
        console.error('[deleteCategory error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete volunteer category.',
        });
    }
};

/**
 * PATCH /api/volunteer-categories/reorder
 * Accepts { orderedIds: number[] } — updates sort_order in DB via transaction.
 */
export const reorderCategoriesHandler = async (req, res) => {
    try {
        const { orderedIds } = req.body || {};
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'orderedIds must be a non-empty array of category IDs.',
            });
        }
        await reorderCategories(orderedIds.map(Number));
        return res.json({ success: true, message: 'Volunteer categories reordered successfully.' });
    } catch (err) {
        console.error('[reorderCategoriesHandler error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to reorder volunteer categories.',
        });
    }
};
