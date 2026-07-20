import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadGoverningBodyPhoto, runMulter } from '../configs/multerS3.js';

// GET /api/admin/governing-bodies/:officeId/staffs
export const getStaffsByOffice = async (req, res) => {
    try {
        const { officeId } = req.params;
        const [rows] = await db.query('SELECT * FROM governing_body_staffs WHERE governing_body_id = ? ORDER BY created_at ASC', [officeId]);
        return successResponse(res, { data: rows }, 'Staffs fetched successfully.');
    } catch (error) {
        console.error('[getStaffsByOffice]', error);
        return errorResponse(res, 'Server error fetching staffs.');
    }
};

const validateStaffBody = (body) => {
    const { name, designation } = body;
    if (!name) return 'name is required.';
    if (!designation) return 'designation is required.';
    return null;
};

// POST /api/admin/governing-bodies/:officeId/staffs
export const createStaff = async (req, res) => {
    try {
        await runMulter(uploadGoverningBodyPhoto, req, res);
        
        const { officeId } = req.params;
        const errorMsg = validateStaffBody(req.body);
        if (errorMsg) return errorResponse(res, errorMsg, 400);

        const { name, designation, phone, email, whatsapp_number, is_key, color, remarks } = req.body;
        const photo_url = req.file ? req.file.location : null;

        const [result] = await db.query(`
            INSERT INTO governing_body_staffs (
                governing_body_id, name, designation, phone, email, whatsapp_number, is_key, color, remarks, photo_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            officeId,
            name,
            designation,
            phone || null,
            email || null,
            whatsapp_number || null,
            is_key === 'true' || is_key === true,
            color || null,
            remarks || null,
            photo_url
        ]);

        if (is_key === 'true' || is_key === true) {
            await db.query('UPDATE governing_body_staffs SET is_key = 0 WHERE governing_body_id = ? AND id != ?', [officeId, result.insertId]);
            await db.query(`
                UPDATE governing_representatives SET 
                    head_name = ?, officer_phone = ?, officer_email = ?,
                    role_id = COALESCE((SELECT id FROM mla_dropdown_lists WHERE label = ? AND \`key\` = 'governing_designation' LIMIT 1), role_id)
                WHERE id = ?
            `, [name, phone || null, email || null, designation, officeId]);
        }

        const [rows] = await db.query('SELECT * FROM governing_body_staffs WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Staff created successfully.', 201);
    } catch (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return errorResponse(res, 'File size too large. Maximum size is 5MB.', 400);
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return errorResponse(res, 'Office not found.', 404);
        }
        console.error('[createStaff]', error);
        return errorResponse(res, 'Server error creating staff.');
    }
};

// PUT /api/admin/governing-bodies/staffs/:staffId
export const updateStaff = async (req, res) => {
    try {
        await runMulter(uploadGoverningBodyPhoto, req, res);

        const { staffId } = req.params;
        const errorMsg = validateStaffBody(req.body);
        if (errorMsg) return errorResponse(res, errorMsg, 400);

        const { name, designation, phone, email, whatsapp_number, is_key, color, remarks } = req.body;

        const [[existing]] = await db.query('SELECT photo_url FROM governing_body_staffs WHERE id = ?', [staffId]);
        if (!existing) {
            return errorResponse(res, 'Staff not found.', 404);
        }

        const photo_url = req.file ? req.file.location : existing.photo_url;

        await db.query(`
            UPDATE governing_body_staffs SET
                name = ?, designation = ?, phone = ?, email = ?, whatsapp_number = ?, is_key = ?, color = ?, remarks = ?, photo_url = ?
            WHERE id = ?
        `, [
            name,
            designation,
            phone || null,
            email || null,
            whatsapp_number || null,
            is_key === 'true' || is_key === true,
            color || null,
            remarks || null,
            photo_url,
            staffId
        ]);

        if (is_key === 'true' || is_key === true) {
            const [[staff]] = await db.query('SELECT governing_body_id FROM governing_body_staffs WHERE id = ?', [staffId]);
            if (staff) {
                await db.query('UPDATE governing_body_staffs SET is_key = 0 WHERE governing_body_id = ? AND id != ?', [staff.governing_body_id, staffId]);
                await db.query(`
                    UPDATE governing_representatives SET 
                        head_name = ?, officer_phone = ?, officer_email = ?,
                        role_id = COALESCE((SELECT id FROM mla_dropdown_lists WHERE label = ? AND \`key\` = 'governing_designation' LIMIT 1), role_id)
                    WHERE id = ?
                `, [name, phone || null, email || null, designation, staff.governing_body_id]);
            }
        }

        const [rows] = await db.query('SELECT * FROM governing_body_staffs WHERE id = ?', [staffId]);
        return successResponse(res, { data: rows[0] }, 'Staff updated successfully.');
    } catch (error) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return errorResponse(res, 'File size too large. Maximum size is 5MB.', 400);
        }
        console.error('[updateStaff]', error);
        return errorResponse(res, 'Server error updating staff.');
    }
};

// DELETE /api/admin/governing-bodies/staffs/:staffId
export const deleteStaff = async (req, res) => {
    try {
        const { staffId } = req.params;
        const [result] = await db.query('DELETE FROM governing_body_staffs WHERE id = ?', [staffId]);

        if (!result.affectedRows) {
            return errorResponse(res, 'Staff not found.', 404);
        }

        return successResponse(res, null, 'Staff deleted successfully.');
    } catch (error) {
        console.error('[deleteStaff]', error);
        return errorResponse(res, 'Server error deleting staff.');
    }
};
