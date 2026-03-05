
import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// ─────────────────────────────────────────────────────────────
//  GET /api/people  — Admin: paginated list with filters
// ─────────────────────────────────────────────────────────────
export const getPeople = async (req, res) => {
    const { search, local_body_id, ward_id, gender } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const offset = (page - 1) * limit;

    try {
        let where = 'WHERE p.is_active = 1';
        const params = [];

        if (search) {
            const like = `%${search}%`;
            where += ' AND (p.full_name LIKE ? OR p.mobile LIKE ? OR p.email LIKE ? OR p.house_name LIKE ?)';
            params.push(like, like, like, like);
        }

        if (local_body_id && local_body_id !== 'all') {
            where += ' AND p.local_body_id = ?';
            params.push(local_body_id);
        }

        if (ward_id && ward_id !== 'all') {
            where += ' AND p.ward_id = ?';
            params.push(ward_id);
        }

        if (gender && gender !== 'all') {
            where += ' AND p.gender = ?';
            params.push(gender.toLowerCase());
        }

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM people p ${where}`, params
        );

        const [rows] = await pool.query(
            `SELECT p.*, lb.name AS local_body_name, lw.ward_no, lw.place_name AS ward_name
             FROM people p
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards lw ON lw.id = p.ward_id
             ${where}
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }, 'People list fetched.');
    } catch (err) {
        console.error('[getPeople]', err);
        return errorResponse(res, 'Failed to fetch people list.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/people/:id  — Admin: specific person details
// ─────────────────────────────────────────────────────────────
export const getPersonById = async (req, res) => {
    try {
        const [[row]] = await pool.query(
            `SELECT p.*, lb.name AS local_body_name, lw.ward_no, lw.place_name AS ward_name
             FROM people p
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards lw ON lw.id = p.ward_id
             WHERE p.id = ?`,
            [req.params.id]
        );
        if (!row) return errorResponse(res, 'Person not found.', 404);
        return successResponse(res, { data: row }, 'Person details fetched.');
    } catch (err) {
        console.error('[getPersonById]', err);
        return errorResponse(res, 'Failed to fetch person details.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/people/:id  — Admin: soft delete person
// ─────────────────────────────────────────────────────────────
export const deletePerson = async (req, res) => {
    try {
        const [result] = await pool.query(
            'UPDATE people SET is_active = 0 WHERE id = ?',
            [req.params.id]
        );
        if (result.affectedRows === 0) return errorResponse(res, 'Person not found.', 404);
        return successResponse(res, null, 'Person deleted successfully.');
    } catch (err) {
        console.error('[deletePerson]', err);
        return errorResponse(res, 'Failed to delete person.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/people  — Admin: create a new resident
// ─────────────────────────────────────────────────────────────
export const createPerson = async (req, res) => {
    const {
        full_name, mobile, email, local_body_id, ward_id,
        house_name, house_no, voter_id, gender, date_of_birth
    } = req.body;

    if (!full_name || !mobile || !local_body_id || !ward_id) {
        return errorResponse(res, 'Full name, mobile, panchayat, and ward are required.', 400);
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO people (
                full_name, mobile, email, local_body_id, ward_id, 
                house_name, house_no, voter_id, gender, date_of_birth
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                full_name,
                mobile,
                email || null,
                local_body_id,
                ward_id,
                house_name || null,
                house_no || null,
                voter_id || null,
                gender || 'male',
                (date_of_birth && date_of_birth !== '') ? date_of_birth : null
            ]
        );
        return successResponse(res, { id: result.insertId }, 'Resident record created successfully.', 201);
    } catch (err) {
        console.error('[createPerson]', err);
        return errorResponse(res, 'Failed to create resident record.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/people/:id  — Admin: update existing resident
// ─────────────────────────────────────────────────────────────
export const updatePerson = async (req, res) => {
    const {
        full_name, mobile, email, local_body_id, ward_id,
        house_name, house_no, voter_id, gender, date_of_birth
    } = req.body;

    if (!full_name || !mobile || !local_body_id || !ward_id) {
        return errorResponse(res, 'Full name, mobile, panchayat, and ward are required.', 400);
    }

    try {
        const [result] = await pool.query(
            `UPDATE people SET 
                full_name = ?, mobile = ?, email = ?, local_body_id = ?, ward_id = ?, 
                house_name = ?, house_no = ?, voter_id = ?, gender = ?, date_of_birth = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                full_name,
                mobile,
                email || null,
                local_body_id,
                ward_id,
                house_name || null,
                house_no || null,
                voter_id || null,
                gender || 'male',
                (date_of_birth && date_of_birth !== '') ? date_of_birth : null,
                req.params.id
            ]
        );
        if (result.affectedRows === 0) return errorResponse(res, 'Person not found.', 404);
        return successResponse(res, null, 'Resident record updated successfully.');
    } catch (err) {
        console.error('[updatePerson]', err);
        return errorResponse(res, 'Failed to update resident record.');
    }
};
