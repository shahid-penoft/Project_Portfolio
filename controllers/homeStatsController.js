import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// GET /api/home/stats (public)
export const getHomeStats = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, value, label, order_index FROM home_stats ORDER BY order_index ASC'
        );
        return successResponse(res, { data: rows }, 'Home stats fetched.');
    } catch (err) {
        console.error('[getHomeStats]', err);
        return errorResponse(res, 'Server error fetching stats.');
    }
};

// PUT /api/home/stats (protected)
export const updateHomeStats = async (req, res) => {
    try {
        const { stats } = req.body;
        if (!Array.isArray(stats)) {
            return errorResponse(res, 'stats must be an array.', 400);
        }

        for (let i = 0; i < stats.length; i++) {
            const item = stats[i];
            if (item.id) {
                await pool.query(
                    'UPDATE home_stats SET value = ?, label = ?, order_index = ? WHERE id = ?',
                    [item.value, item.label, item.order_index !== undefined ? item.order_index : i, item.id]
                );
            } else {
                await pool.query(
                    'INSERT INTO home_stats (value, label, order_index) VALUES (?, ?, ?)',
                    [item.value, item.label, item.order_index !== undefined ? item.order_index : i]
                );
            }
        }

        const [rows] = await pool.query(
            'SELECT id, value, label, order_index FROM home_stats ORDER BY order_index ASC'
        );
        return successResponse(res, { data: rows }, 'Home stats updated.');
    } catch (err) {
        console.error('[updateHomeStats]', err);
        return errorResponse(res, 'Server error updating stats.');
    }
};
