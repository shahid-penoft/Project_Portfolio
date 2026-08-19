import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const getTeamMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT t.*, au.full_name as name, r.name as role, au.profile_image 
             FROM project_team_members t
             JOIN admin_users au ON t.admin_user_id = au.id
             LEFT JOIN admin_roles r ON au.role_id = r.id
             WHERE t.project_id = ? ORDER BY t.assigned_at DESC`, [id]
        );
        return successResponse(res, { data: rows }, 'Team members fetched.');
    } catch (err) {
        console.error('[getTeamMembers]', err);
        return errorResponse(res, 'Server error fetching team members.');
    }
};

export const addTeamMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_user_id } = req.body;

        if (!admin_user_id) return errorResponse(res, 'User ID is required.', 400);

        try {
            await db.query(
                `INSERT INTO project_team_members (project_id, admin_user_id) VALUES (?, ?)`,
                [id, admin_user_id]
            );
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
                return errorResponse(res, 'User is already in the team.', 400);
            }
            throw e;
        }

        const [rows] = await db.query(
            `SELECT t.*, au.full_name as name, r.name as role, au.profile_image 
             FROM project_team_members t
             JOIN admin_users au ON t.admin_user_id = au.id
             LEFT JOIN admin_roles r ON au.role_id = r.id
             WHERE t.project_id = ? AND t.admin_user_id = ?`, [id, admin_user_id]
        );
        return successResponse(res, { data: rows[0] }, 'Team member added.', 201);
    } catch (err) {
        console.error('[addTeamMember]', err);
        return errorResponse(res, 'Server error adding team member.');
    }
};

export const removeTeamMember = async (req, res) => {
    try {
        const { id, uid } = req.params;
        const [result] = await db.query(
            'DELETE FROM project_team_members WHERE project_id = ? AND (admin_user_id = ? OR id = ?)',
            [id, uid, uid]
        );
        if (!result.affectedRows) return errorResponse(res, 'Team member not found.', 404);
        return successResponse(res, {}, 'Team member removed.');
    } catch (err) {
        console.error('[removeTeamMember]', err);
        return errorResponse(res, 'Server error removing team member.');
    }
};
