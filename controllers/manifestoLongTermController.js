import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multer.js';

// ─────────────────────────────────────────────────────────────
//  GET /api/manifesto/long-term-commitments
//  Public — paginated, optional search
// ─────────────────────────────────────────────────────────────
export const getCommitments = async (req, res) => {
    const { search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    try {
        let where = 'WHERE 1=1';
        const params = [];

        if (search) {
            const like = `%${search}%`;
            where += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(like, like);
        }

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM manifesto_long_term_commitments ${where}`, params
        );

        const [rows] = await pool.query(
            `SELECT * FROM manifesto_long_term_commitments ${where} ORDER BY order_index ASC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Commitments fetched successfully.');
    } catch (err) {
        console.error('[getCommitments]', err);
        return errorResponse(res, 'Failed to fetch commitments.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/manifesto/long-term-commitments  (Auth)
// ─────────────────────────────────────────────────────────────
export const createCommitment = async (req, res) => {
    const { title, description, icon_url, order_index } = req.body;

    if (!title?.trim())
        return errorResponse(res, 'title is required.', 400);

    try {
        let idx = order_index;
        if (idx === undefined || idx === null) {
            const [[{ maxIdx }]] = await pool.query(
                'SELECT COALESCE(MAX(order_index), -1) AS maxIdx FROM manifesto_long_term_commitments'
            );
            idx = maxIdx + 1;
        }

        const [result] = await pool.query(
            'INSERT INTO manifesto_long_term_commitments (title, description, icon_url, order_index) VALUES (?, ?, ?, ?)',
            [title.trim(), description?.trim() || null, icon_url || null, idx]
        );

        const [[row]] = await pool.query(
            'SELECT * FROM manifesto_long_term_commitments WHERE id = ?', [result.insertId]
        );
        return successResponse(res, { data: row }, 'Commitment created successfully.', 201);
    } catch (err) {
        console.error('[createCommitment]', err);
        return errorResponse(res, 'Failed to create commitment.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/manifesto/long-term-commitments/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const updateCommitment = async (req, res) => {
    const { id } = req.params;
    const { title, description, icon_url, order_index } = req.body;

    if (!title?.trim())
        return errorResponse(res, 'title is required.', 400);

    try {
        const [result] = await pool.query(
            'UPDATE manifesto_long_term_commitments SET title = ?, description = ?, icon_url = ?, order_index = ? WHERE id = ?',
            [title.trim(), description?.trim() || null, icon_url || null, order_index ?? 0, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Commitment not found.', 404);

        const [[row]] = await pool.query(
            'SELECT * FROM manifesto_long_term_commitments WHERE id = ?', [id]
        );
        return successResponse(res, { data: row }, 'Commitment updated successfully.');
    } catch (err) {
        console.error('[updateCommitment]', err);
        return errorResponse(res, 'Failed to update commitment.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/manifesto/long-term-commitments/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const deleteCommitment = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query(
            'DELETE FROM manifesto_long_term_commitments WHERE id = ?', [id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Commitment not found.', 404);
        return successResponse(res, {}, 'Commitment deleted successfully.');
    } catch (err) {
        console.error('[deleteCommitment]', err);
        return errorResponse(res, 'Failed to delete commitment.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/manifesto/long-term-commitments/:id/promote  (Auth)
// ─────────────────────────────────────────────────────────────
export const promoteCommitment = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE manifesto_long_term_commitments SET order_index = order_index + 1');
        await pool.query('UPDATE manifesto_long_term_commitments SET order_index = 0 WHERE id = ?', [id]);
        return successResponse(res, {}, 'Commitment promoted to top.');
    } catch (err) {
        console.error('[promoteCommitment]', err);
        return errorResponse(res, 'Failed to promote commitment.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/manifesto/long-term-commitments/upload  (Auth)
// ─────────────────────────────────────────────────────────────
export const uploadCommitmentIcon = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: `/uploads/${req.file.filename}` }, 'Icon uploaded.');
    } catch (err) {
        console.error('[uploadCommitmentIcon]', err);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};
