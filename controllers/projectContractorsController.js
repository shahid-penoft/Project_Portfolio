import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const getContractors = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM project_contractors WHERE project_id = ? ORDER BY created_at DESC', [id]);
        return successResponse(res, { data: rows }, 'Contractors fetched.');
    } catch (err) {
        console.error('[getContractors]', err);
        return errorResponse(res, 'Server error fetching contractors.');
    }
};

export const addContractor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact_person, role, phone, email, description } = req.body;

        if (!name?.trim()) return errorResponse(res, 'Contractor name is required.', 400);

        const [result] = await db.query(
            `INSERT INTO project_contractors (project_id, name, contact_person, role, phone, email, description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, name.trim(), contact_person || null, role || null, phone || null, email || null, description || null]
        );

        const [rows] = await db.query('SELECT * FROM project_contractors WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Contractor added.', 201);
    } catch (err) {
        console.error('[addContractor]', err);
        return errorResponse(res, 'Server error adding contractor.');
    }
};

export const updateContractor = async (req, res) => {
    try {
        const { id, cid } = req.params;
        const { name, contact_person, role, phone, email, description } = req.body;

        const fields = [];
        const vals = [];
        if (name !== undefined) { fields.push('name = ?'); vals.push(name.trim()); }
        if (contact_person !== undefined) { fields.push('contact_person = ?'); vals.push(contact_person); }
        if (role !== undefined) { fields.push('role = ?'); vals.push(role); }
        if (phone !== undefined) { fields.push('phone = ?'); vals.push(phone); }
        if (email !== undefined) { fields.push('email = ?'); vals.push(email); }
        if (description !== undefined) { fields.push('description = ?'); vals.push(description); }

        if (fields.length === 0) return errorResponse(res, 'No data to update.', 400);
        vals.push(cid, id);

        await db.query(`UPDATE project_contractors SET ${fields.join(', ')} WHERE id = ? AND project_id = ?`, vals);

        const [rows] = await db.query('SELECT * FROM project_contractors WHERE id = ?', [cid]);
        return successResponse(res, { data: rows[0] }, 'Contractor updated.');
    } catch (err) {
        console.error('[updateContractor]', err);
        return errorResponse(res, 'Server error updating contractor.');
    }
};

export const deleteContractor = async (req, res) => {
    try {
        const { id, cid } = req.params;
        const [result] = await db.query('DELETE FROM project_contractors WHERE id = ? AND project_id = ?', [cid, id]);
        if (!result.affectedRows) return errorResponse(res, 'Contractor not found.', 404);
        return successResponse(res, {}, 'Contractor deleted.');
    } catch (err) {
        console.error('[deleteContractor]', err);
        return errorResponse(res, 'Server error deleting contractor.');
    }
};
