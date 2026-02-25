import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// ─────────────────────────────────────────────────────────────
//  GET /api/achievements
//  Public — paginated, optional search
// ─────────────────────────────────────────────────────────────
export const getAchievements = async (req, res) => {
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
            `SELECT COUNT(*) AS total FROM achievements ${where}`, params
        );

        const [rows] = await pool.query(
            `SELECT * FROM achievements ${where} ORDER BY order_index ASC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Achievements fetched successfully.');
    } catch (err) {
        console.error('[getAchievements]', err);
        return errorResponse(res, 'Failed to fetch achievements.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/achievements  (Auth)
// ─────────────────────────────────────────────────────────────
export const createAchievement = async (req, res) => {
    const { title, description, order_index } = req.body;

    if (!title?.trim())
        return errorResponse(res, 'title is required.', 400);

    try {
        // Place at the end if no order provided
        let idx = order_index;
        if (idx === undefined || idx === null) {
            const [[{ maxIdx }]] = await pool.query(
                'SELECT COALESCE(MAX(order_index), -1) AS maxIdx FROM achievements'
            );
            idx = maxIdx + 1;
        }

        const [result] = await pool.query(
            'INSERT INTO achievements (title, description, order_index) VALUES (?, ?, ?)',
            [title.trim(), description?.trim() || null, idx]
        );

        const [[row]] = await pool.query('SELECT * FROM achievements WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: row }, 'Achievement created successfully.', 201);
    } catch (err) {
        console.error('[createAchievement]', err);
        return errorResponse(res, 'Failed to create achievement.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/achievements/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const updateAchievement = async (req, res) => {
    const { id } = req.params;
    const { title, description, order_index } = req.body;

    if (!title?.trim())
        return errorResponse(res, 'title is required.', 400);

    try {
        const [result] = await pool.query(
            'UPDATE achievements SET title = ?, description = ?, order_index = ? WHERE id = ?',
            [title.trim(), description?.trim() || null, order_index ?? 0, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Achievement not found.', 404);

        const [[row]] = await pool.query('SELECT * FROM achievements WHERE id = ?', [id]);
        return successResponse(res, { data: row }, 'Achievement updated successfully.');
    } catch (err) {
        console.error('[updateAchievement]', err);
        return errorResponse(res, 'Failed to update achievement.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/achievements/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const deleteAchievement = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM achievements WHERE id = ?', [id]);
        if (!result.affectedRows) return errorResponse(res, 'Achievement not found.', 404);
        return successResponse(res, {}, 'Achievement deleted successfully.');
    } catch (err) {
        console.error('[deleteAchievement]', err);
        return errorResponse(res, 'Failed to delete achievement.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/achievements/:id/promote  (Auth)
//  Move this item to order_index = 0 (top of list)
// ─────────────────────────────────────────────────────────────
export const promoteAchievement = async (req, res) => {
    const { id } = req.params;
    try {
        // Shift all others down by 1, then set this one to 0
        await pool.query('UPDATE achievements SET order_index = order_index + 1');
        await pool.query('UPDATE achievements SET order_index = 0 WHERE id = ?', [id]);
        return successResponse(res, {}, 'Achievement promoted to top.');
    } catch (err) {
        console.error('[promoteAchievement]', err);
        return errorResponse(res, 'Failed to promote achievement.');
    }
};
