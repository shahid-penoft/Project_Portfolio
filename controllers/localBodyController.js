import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// GET /api/local-bodies
export const getAllLocalBodies = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM local_bodies ORDER BY name ASC');
        return successResponse(res, { data: rows }, 'Local bodies fetched successfully.');
    } catch (err) {
        console.error('[getAllLocalBodies]', err);
        return errorResponse(res, 'Server error fetching local bodies.');
    }
};

// POST /api/local-bodies
export const createLocalBody = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'INSERT INTO local_bodies (name, description) VALUES (?, ?)',
            [name.trim(), description || null]
        );
        const [rows] = await db.query('SELECT * FROM local_bodies WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Local body created successfully.', 201);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A local body with this name already exists.', 409);
        console.error('[createLocalBody]', err);
        return errorResponse(res, 'Server error creating local body.');
    }
};

// PUT /api/local-bodies/:id
export const updateLocalBody = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'UPDATE local_bodies SET name = ?, description = ? WHERE id = ?',
            [name.trim(), description || null, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Local body not found.', 404);
        const [rows] = await db.query('SELECT * FROM local_bodies WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Local body updated successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A local body with this name already exists.', 409);
        console.error('[updateLocalBody]', err);
        return errorResponse(res, 'Server error updating local body.');
    }
};

// DELETE /api/local-bodies/:id
export const deleteLocalBody = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM local_bodies WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return errorResponse(res, 'Local body not found.', 404);
        return successResponse(res, {}, 'Local body deleted successfully.');
    } catch (err) {
        console.error('[deleteLocalBody]', err);
        return errorResponse(res, 'Server error deleting local body.');
    }
};
