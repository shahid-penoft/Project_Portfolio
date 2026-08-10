import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

const parseJson = (val, fallback = []) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

// GET /api/home/section-order (public/protected)
export const getSectionOrder = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM home_section_order ORDER BY order_index ASC'
        );
        return successResponse(res, { data: rows }, 'Section order fetched.');
    } catch (err) {
        console.error('[getSectionOrder]', err);
        return errorResponse(res, 'Server error fetching section order.');
    }
};

// PUT /api/home/section-order (protected)
export const updateSectionOrder = async (req, res) => {
    try {
        const { sections } = req.body;
        if (!Array.isArray(sections)) {
            return errorResponse(res, 'sections must be an array.', 400);
        }

        for (const s of sections) {
            const { section_id, order_index, visibility = 'both' } = s;
            if (!section_id) continue;
            await pool.query(
                `INSERT INTO home_section_order (section_id, order_index, visibility)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE order_index = VALUES(order_index), visibility = VALUES(visibility)`,
                [section_id, parseInt(order_index) || 0, visibility]
            );
        }

        const [rows] = await pool.query(
            'SELECT * FROM home_section_order ORDER BY order_index ASC'
        );
        return successResponse(res, { data: rows }, 'Section order updated.');
    } catch (err) {
        console.error('[updateSectionOrder]', err);
        return errorResponse(res, 'Server error updating section order.');
    }
};
