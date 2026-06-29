import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const getActivityLogs = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT l.*, au.full_name as author_name 
             FROM project_activity_logs l
             LEFT JOIN admin_users au ON l.admin_user_id = au.id
             WHERE l.project_id = ? ORDER BY l.created_at DESC LIMIT 100`, [id]
        );
        return successResponse(res, { data: rows }, 'Activity logs fetched.');
    } catch (err) {
        console.error('[getActivityLogs]', err);
        return errorResponse(res, 'Server error fetching activity logs.');
    }
};

export const addActivityLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        if (!text?.trim()) return errorResponse(res, 'Activity text is required.', 400);

        const admin_user_id = req.user?.id || null;

        const [result] = await db.query(
            `INSERT INTO project_activity_logs (project_id, admin_user_id, text) VALUES (?, ?, ?)`,
            [id, admin_user_id, text.trim()]
        );

        const [rows] = await db.query(
            `SELECT l.*, au.full_name as author_name 
             FROM project_activity_logs l
             LEFT JOIN admin_users au ON l.admin_user_id = au.id
             WHERE l.id = ?`, [result.insertId]
        );
        return successResponse(res, { data: rows[0] }, 'Activity logged.', 201);
    } catch (err) {
        console.error('[addActivityLog]', err);
        return errorResponse(res, 'Server error logging activity.');
    }
};
