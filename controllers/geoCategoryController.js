import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

/**
 * GET /api/geo-categories
 * Returns a nested tree of categories (parents -> children)
 */
export const getGeoCategories = async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT id, name, parent_id FROM geo_categories ORDER BY parent_id ASC, name ASC`);
        
        // Build tree
        const categoryMap = {};
        const roots = [];

        rows.forEach(row => {
            categoryMap[row.id] = { ...row, children: [] };
        });

        rows.forEach(row => {
            if (row.parent_id === null) {
                roots.push(categoryMap[row.id]);
            } else if (categoryMap[row.parent_id]) {
                categoryMap[row.parent_id].children.push(categoryMap[row.id]);
            }
        });

        return successResponse(res, { data: roots });
    } catch (error) {
        console.error('[getGeoCategories]', error);
        return errorResponse(res, 'Failed to fetch categories.');
    }
};

/**
 * POST /api/geo-categories
 * Creates a new category or sub-category
 */
export const createGeoCategory = async (req, res) => {
    try {
        const { name, parent_id } = req.body;
        if (!name) {
            return errorResponse(res, 'Category name is required.', 400);
        }

        const [result] = await db.query(
            `INSERT INTO geo_categories (name, parent_id) VALUES (?, ?)`,
            [name, parent_id || null]
        );

        const [[newCategory]] = await db.query(`SELECT * FROM geo_categories WHERE id = ?`, [result.insertId]);
        return successResponse(res, newCategory, 'Category created successfully.', 201);
    } catch (error) {
        console.error('[createGeoCategory]', error);
        return errorResponse(res, 'Failed to create category.');
    }
};

/**
 * PUT /api/geo-categories/:id
 * Updates a category
 */
export const updateGeoCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parent_id } = req.body;

        if (!name) {
            return errorResponse(res, 'Category name is required.', 400);
        }

        // Prevent self-parenting
        if (id === String(parent_id)) {
            return errorResponse(res, 'A category cannot be its own parent.', 400);
        }

        const [result] = await db.query(
            `UPDATE geo_categories SET name = ?, parent_id = ? WHERE id = ?`,
            [name, parent_id || null, id]
        );

        if (result.affectedRows === 0) {
            return errorResponse(res, 'Category not found.', 404);
        }

        const [[updatedCategory]] = await db.query(`SELECT * FROM geo_categories WHERE id = ?`, [id]);
        return successResponse(res, updatedCategory, 'Category updated successfully.');
    } catch (error) {
        console.error('[updateGeoCategory]', error);
        return errorResponse(res, 'Failed to update category.');
    }
};

/**
 * DELETE /api/geo-categories/:id
 * Deletes a category and its children (via CASCADE)
 */
export const deleteGeoCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(`DELETE FROM geo_categories WHERE id = ?`, [id]);

        if (result.affectedRows === 0) {
            return errorResponse(res, 'Category not found.', 404);
        }

        return successResponse(res, null, 'Category deleted successfully.');
    } catch (error) {
        console.error('[deleteGeoCategory]', error);
        return errorResponse(res, 'Failed to delete category.');
    }
};
