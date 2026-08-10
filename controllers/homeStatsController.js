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
