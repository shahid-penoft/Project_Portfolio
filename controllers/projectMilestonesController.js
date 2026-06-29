import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const getMilestones = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM project_milestones WHERE project_id = ? ORDER BY display_order ASC, target_date ASC', [id]);
        return successResponse(res, { data: rows }, 'Milestones fetched.');
    } catch (err) {
        console.error('[getMilestones]', err);
        return errorResponse(res, 'Server error fetching milestones.');
    }
};

export const addMilestone = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, status = 'Pending', target_date, display_order = 0 } = req.body;

        if (!title?.trim()) return errorResponse(res, 'Title is required.', 400);

        const [result] = await db.query(
            `INSERT INTO project_milestones (project_id, title, status, target_date, display_order)
             VALUES (?, ?, ?, ?, ?)`,
            [id, title.trim(), status, target_date || null, display_order]
        );

        const [rows] = await db.query('SELECT * FROM project_milestones WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Milestone added.', 201);
    } catch (err) {
        console.error('[addMilestone]', err);
        return errorResponse(res, 'Server error adding milestone.');
    }
};

export const updateMilestone = async (req, res) => {
    try {
        const { id, mid } = req.params;
        const { title, status, target_date, display_order } = req.body;

        const fields = [];
        const vals = [];
        if (title !== undefined) { fields.push('title = ?'); vals.push(title.trim()); }
        if (status !== undefined) { fields.push('status = ?'); vals.push(status); }
        if (target_date !== undefined) { fields.push('target_date = ?'); vals.push(target_date); }
        if (display_order !== undefined) { fields.push('display_order = ?'); vals.push(display_order); }

        if (fields.length === 0) return errorResponse(res, 'No data to update.', 400);
        vals.push(mid, id);

        await db.query(`UPDATE project_milestones SET ${fields.join(', ')} WHERE id = ? AND project_id = ?`, vals);

        const [rows] = await db.query('SELECT * FROM project_milestones WHERE id = ?', [mid]);
        return successResponse(res, { data: rows[0] }, 'Milestone updated.');
    } catch (err) {
        console.error('[updateMilestone]', err);
        return errorResponse(res, 'Server error updating milestone.');
    }
};

export const deleteMilestone = async (req, res) => {
    try {
        const { id, mid } = req.params;
        const [result] = await db.query('DELETE FROM project_milestones WHERE id = ? AND project_id = ?', [mid, id]);
        if (!result.affectedRows) return errorResponse(res, 'Milestone not found.', 404);
        return successResponse(res, {}, 'Milestone deleted.');
    } catch (err) {
        console.error('[deleteMilestone]', err);
        return errorResponse(res, 'Server error deleting milestone.');
    }
};
