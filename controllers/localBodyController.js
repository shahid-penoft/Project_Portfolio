import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multer.js';

// GET /api/local-bodies
export const getAllLocalBodies = async (req, res) => {
    try {
        const { page, limit, search } = req.query;

        // If no pagination params are provided, maintain legacy behavior (fetch all)
        if (!page || !limit) {
            const [rows] = await db.query('SELECT * FROM local_bodies ORDER BY name ASC');
            return successResponse(res, { data: rows }, 'Local bodies fetched successfully.');
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        let query = 'SELECT * FROM local_bodies';
        let countQuery = 'SELECT COUNT(*) as total FROM local_bodies';
        const queryParams = [];

        if (search) {
            query += ' WHERE name LIKE ? OR description LIKE ? OR short_description LIKE ?';
            countQuery += ' WHERE name LIKE ? OR description LIKE ? OR short_description LIKE ?';
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY name ASC LIMIT ? OFFSET ?';

        const [rows] = await db.query(query, [...queryParams, limitNum, offset]);
        const [countResult] = await db.query(countQuery, queryParams);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limitNum);

        return successResponse(res, {
            data: rows,
            pagination: { total, page: pageNum, limit: limitNum, totalPages }
        }, 'Local bodies fetched successfully.');
    } catch (err) {
        console.error('[getAllLocalBodies]', err);
        return errorResponse(res, 'Server error fetching local bodies.');
    }
};

// POST /api/local-bodies
export const createLocalBody = async (req, res) => {
    try {
        const { name, description, short_description, cover_image, population, area } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'INSERT INTO local_bodies (name, description, short_description, cover_image, population, area) VALUES (?, ?, ?, ?, ?, ?)',
            [name.trim(), description || null, short_description || null, cover_image || null, population || null, area || null]
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
        const { name, description, short_description, cover_image, population, area } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'UPDATE local_bodies SET name = ?, description = ?, short_description = ?, cover_image = ?, population = ?, area = ? WHERE id = ?',
            [name.trim(), description || null, short_description || null, cover_image || null, population || null, area || null, id]
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

// POST /api/local-bodies/upload
export const uploadLocalBodyImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: `/uploads/${req.file.filename}` }, 'Image uploaded.');
    } catch (err) {
        console.error('[uploadLocalBodyImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Upload failed.');
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
