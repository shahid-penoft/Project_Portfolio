import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// GET /api/sectors
export const getAllSectors = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sectors ORDER BY name ASC');
        return successResponse(res, { data: rows }, 'Sectors fetched successfully.');
    } catch (err) {
        console.error('[getAllSectors]', err);
        return errorResponse(res, 'Server error fetching sectors.');
    }
};

// POST /api/sectors
export const createSector = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'INSERT INTO sectors (name, description) VALUES (?, ?)',
            [name.trim(), description || null]
        );
        const [rows] = await db.query('SELECT * FROM sectors WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Sector created successfully.', 201);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A sector with this name already exists.', 409);
        console.error('[createSector]', err);
        return errorResponse(res, 'Server error creating sector.');
    }
};

// PUT /api/sectors/:id
export const updateSector = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'UPDATE sectors SET name = ?, description = ? WHERE id = ?',
            [name.trim(), description || null, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Sector not found.', 404);
        const [rows] = await db.query('SELECT * FROM sectors WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Sector updated successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A sector with this name already exists.', 409);
        console.error('[updateSector]', err);
        return errorResponse(res, 'Server error updating sector.');
    }
};

// DELETE /api/sectors/:id
export const deleteSector = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM sectors WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return errorResponse(res, 'Sector not found.', 404);
        return successResponse(res, {}, 'Sector deleted successfully.');
    } catch (err) {
        console.error('[deleteSector]', err);
        return errorResponse(res, 'Server error deleting sector.');
    }
};
