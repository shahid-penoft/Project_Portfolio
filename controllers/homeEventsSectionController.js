import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// GET /api/home/events-section (public)
export const getHomeEventsSection = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM home_events_section WHERE id = 1');
        if (!rows.length) {
            return successResponse(res, {
                data: {
                    title: 'Upcoming Events',
                    description: 'Join events, community meetings, and campaigns that shape the future of Kothamangalam.',
                    button_text: 'View All Events',
                    button_url: '/events'
                }
            }, 'Default home events section.');
        }
        return successResponse(res, { data: rows[0] }, 'Home events section fetched.');
    } catch (err) {
        console.error('[getHomeEventsSection]', err);
        return errorResponse(res, 'Server error fetching home events section.');
    }
};

// PUT /api/home/events-section (protected)
export const updateHomeEventsSection = async (req, res) => {
    try {
        const { title, description, button_text, button_url } = req.body;

        await pool.query(
            `INSERT INTO home_events_section (id, title, description, button_text, button_url)
             VALUES (1, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             title = VALUES(title),
             description = VALUES(description),
             button_text = VALUES(button_text),
             button_url = VALUES(button_url)`,
            [
                title || 'Upcoming Events',
                description || '',
                button_text || 'View All Events',
                button_url || '/events'
            ]
        );

        const [rows] = await pool.query('SELECT * FROM home_events_section WHERE id = 1');
        return successResponse(res, { data: rows[0] }, 'Home events section updated.');
    } catch (err) {
        console.error('[updateHomeEventsSection]', err);
        return errorResponse(res, 'Server error updating home events section.');
    }
};
