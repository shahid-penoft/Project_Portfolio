import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

const TABLE = 'manifesto_development_goals';

// ─────────────────────────────────────────────────────────────
//  GET /api/manifesto/development-goals
//  Public — paginated, optional search
// ─────────────────────────────────────────────────────────────
export const getDevGoals = async (req, res) => {
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
            `SELECT COUNT(*) AS total FROM ${TABLE} ${where}`, params
        );

        const [rows] = await pool.query(
            `SELECT * FROM ${TABLE} ${where} ORDER BY order_index ASC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Development goals fetched successfully.');
    } catch (err) {
        console.error('[getDevGoals]', err);
        return errorResponse(res, 'Failed to fetch development goals.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/manifesto/development-goals  (Auth)
// ─────────────────────────────────────────────────────────────
export const createDevGoal = async (req, res) => {
    const { title, description, order_index } = req.body;

    if (!title?.trim())
        return errorResponse(res, 'title is required.', 400);

    try {
        let idx = order_index;
        if (idx === undefined || idx === null) {
            const [[{ maxIdx }]] = await pool.query(
                `SELECT COALESCE(MAX(order_index), -1) AS maxIdx FROM ${TABLE}`
            );
            idx = maxIdx + 1;
        }

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (title, description, order_index) VALUES (?, ?, ?)`,
            [title.trim(), description?.trim() || null, idx]
        );

        const [[row]] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [result.insertId]);
        return successResponse(res, { data: row }, 'Development goal created successfully.', 201);
    } catch (err) {
        console.error('[createDevGoal]', err);
        return errorResponse(res, 'Failed to create development goal.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/manifesto/development-goals/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const updateDevGoal = async (req, res) => {
    const { id } = req.params;
    const { title, description, order_index } = req.body;

    if (!title?.trim())
        return errorResponse(res, 'title is required.', 400);

    try {
        const [result] = await pool.query(
            `UPDATE ${TABLE} SET title = ?, description = ?, order_index = ? WHERE id = ?`,
            [title.trim(), description?.trim() || null, order_index ?? 0, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Goal not found.', 404);

        const [[row]] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
        return successResponse(res, { data: row }, 'Development goal updated successfully.');
    } catch (err) {
        console.error('[updateDevGoal]', err);
        return errorResponse(res, 'Failed to update development goal.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/manifesto/development-goals/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const deleteDevGoal = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
        if (!result.affectedRows) return errorResponse(res, 'Goal not found.', 404);
        return successResponse(res, {}, 'Development goal deleted successfully.');
    } catch (err) {
        console.error('[deleteDevGoal]', err);
        return errorResponse(res, 'Failed to delete development goal.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/manifesto/development-goals/:id/promote  (Auth)
// ─────────────────────────────────────────────────────────────
export const promoteDevGoal = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE ${TABLE} SET order_index = order_index + 1`);
        await pool.query(`UPDATE ${TABLE} SET order_index = 0 WHERE id = ?`, [id]);
        return successResponse(res, {}, 'Development goal promoted to top.');
    } catch (err) {
        console.error('[promoteDevGoal]', err);
        return errorResponse(res, 'Failed to promote development goal.');
    }
};
