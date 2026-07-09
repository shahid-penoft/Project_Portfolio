import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadGoverningBodyPhoto, runMulter } from '../configs/multerS3.js';

const parseJsonField = (field) => {
    if (!field) return [];
    try {
        if (typeof field === 'string') return JSON.parse(field);
        return field;
    } catch (e) {
        return [];
    }
};

const validateBody = (body) => {
    const { governing_body_type, local_body_id, name, role_id, phone, department, head_name, status } = body;
    if (!governing_body_type || !['GRAM_PANCHAYAT', 'MUNICIPALITY', 'BLOCK_PANCHAYAT', 'DISTRICT_PANCHAYAT', 'OTHER'].includes(governing_body_type)) {
        return 'Invalid or missing governing_body_type.';
    }

    // Skip strict validation for drafts
    if (status === 'Draft') {
        if (!name) return 'name is required.';
        if (!phone) return 'phone is required.';
        if (governing_body_type !== 'OTHER' && !local_body_id) return 'local_body_id is required.';
        return null;
    }
    
    if (governing_body_type === 'OTHER') {
        if (!name) return 'name is required.';
        if (!department) return 'department is required.';
        if (!head_name) return 'head_name is required.';
        if (!phone) return 'phone is required.';
        return null;
    }

    if (!local_body_id) return 'local_body_id is required.';
    if (!name) return 'name is required.';
    if (!role_id) return 'role_id is required.';
    if (!phone) return 'phone is required.';
    return null;
};

// GET /api/admin/governing-bodies
export const getGoverningBodies = async (req, res) => {
    try {
        const { type, localBodyId, wardId, roleId, search, bookmarked, sortBy, page, limit, trash } = req.query;

        let query = `
            SELECT 
                gr.*,
                lb.name AS localBodyName,
                w.place_name AS wardName,
                w.ward_no AS wardNumber,
                r.label AS roleName
            FROM governing_representatives gr
            LEFT JOIN local_bodies lb ON gr.local_body_id = lb.id
            LEFT JOIN local_body_wards w ON gr.ward_id = w.id
            LEFT JOIN mla_dropdown_lists r ON gr.role_id = r.id
            WHERE 1=1
        `;
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM governing_representatives gr
            LEFT JOIN local_bodies lb ON gr.local_body_id = lb.id
            LEFT JOIN local_body_wards w ON gr.ward_id = w.id
            LEFT JOIN mla_dropdown_lists r ON gr.role_id = r.id
            WHERE 1=1
        `;
        
        const params = [];

        // Trash filter — only show trashed or active records
        const isTrash = trash === 'true';
        query += isTrash ? ' AND gr.is_deleted = 1' : ' AND (gr.is_deleted = 0 OR gr.is_deleted IS NULL)';
        countQuery += isTrash ? ' AND gr.is_deleted = 1' : ' AND (gr.is_deleted = 0 OR gr.is_deleted IS NULL)';

        // Status filter (e.g. status=Draft)
        const { status } = req.query;
        if (status) {
            query += ' AND gr.status = ?';
            countQuery += ' AND gr.status = ?';
            params.push(status);
        }

        if (type) {
            query += ' AND gr.governing_body_type = ?';
            countQuery += ' AND gr.governing_body_type = ?';
            params.push(type);
        }
        if (localBodyId) {
            query += ' AND gr.local_body_id = ?';
            countQuery += ' AND gr.local_body_id = ?';
            params.push(localBodyId);
        }
        if (wardId) {
            query += ' AND gr.ward_id = ?';
            countQuery += ' AND gr.ward_id = ?';
            params.push(wardId);
        }
        if (roleId) {
            query += ' AND gr.role_id = ?';
            countQuery += ' AND gr.role_id = ?';
            params.push(roleId);
        }
        if (bookmarked !== undefined) {
            const isBookmarked = bookmarked === 'true' || bookmarked === '1';
            query += ' AND gr.bookmarked = ?';
            countQuery += ' AND gr.bookmarked = ?';
            params.push(isBookmarked);
        }
        if (search) {
            query += ' AND (gr.name LIKE ? OR gr.phone LIKE ? OR lb.name LIKE ?)';
            countQuery += ' AND (gr.name LIKE ? OR gr.phone LIKE ? OR lb.name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Sorting
        if (sortBy === 'name-asc') {
            query += ' ORDER BY gr.name ASC';
        } else if (sortBy === 'name-desc') {
            query += ' ORDER BY gr.name DESC';
        } else if (sortBy === 'ward-asc') {
            query += ' ORDER BY CAST(w.ward_no AS UNSIGNED) ASC';
        } else if (sortBy === 'ward-desc') {
            query += ' ORDER BY CAST(w.ward_no AS UNSIGNED) DESC';
        } else {
            query += ' ORDER BY gr.created_at DESC';
        }

        // Pagination
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;
        
        // Only apply pagination if requested
        if (page && limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(limitNum, offset);
        }

        const [rows] = await db.query(query, params);
        
        let pagination = null;
        if (page && limit) {
            const [countResult] = await db.query(countQuery, params.slice(0, params.length - 2));
            const total = countResult[0].total;
            pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
        }

        return successResponse(res, { data: rows, pagination }, 'Governing bodies fetched successfully.');
    } catch (error) {
        console.error('[getGoverningBodies]', error);
        return errorResponse(res, 'Server error fetching governing bodies.');
    }
};

// GET /api/admin/governing-bodies/:id
export const getGoverningBodyById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                gr.*,
                lb.name AS localBodyName,
                w.place_name AS wardName,
                w.ward_no AS wardNumber,
                r.label AS roleName
            FROM governing_representatives gr
            LEFT JOIN local_bodies lb ON gr.local_body_id = lb.id
            LEFT JOIN local_body_wards w ON gr.ward_id = w.id
            LEFT JOIN mla_dropdown_lists r ON gr.role_id = r.id
            WHERE gr.id = ?
        `;
        const [rows] = await db.query(query, [id]);

        if (!rows.length) {
            return errorResponse(res, 'Governing body representative not found.', 404);
        }

        return successResponse(res, { data: rows[0] }, 'Governing body representative fetched successfully.');
    } catch (error) {
        console.error('[getGoverningBodyById]', error);
        return errorResponse(res, 'Server error fetching representative.');
    }
};

// POST /api/admin/governing-bodies
export const createGoverningBody = async (req, res) => {
    try {
        await runMulter(uploadGoverningBodyPhoto, req, res);

        console.log("[createGoverningBody] req.body:", req.body);

        const errorMsg = validateBody(req.body);
        if (errorMsg) return errorResponse(res, errorMsg, 400);

        const {
            governing_body_type, local_body_id, ward_id, name, role_id, gender, age, 
            phone, alternative_phone, email, house_name, home_address, location, 
            bio, office_name, office_phone, office_email, office_address, office_location, 
            additional_roles, achievements, notes, bookmarked,
            department, head_name, hours, avatar_color, officer_phone, status
        } = req.body;

        const photo_url = req.file ? req.file.location : null;

        const [result] = await db.query(`
            INSERT INTO governing_representatives (
                governing_body_type, local_body_id, ward_id, name, role_id, gender, age,
                phone, alternative_phone, email, house_name, home_address, location,
                bio, office_name, office_phone, office_email, office_address, office_location,
                additional_roles, achievements, notes, bookmarked, photo_url,
                department, head_name, hours, avatar_color, officer_phone, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            governing_body_type, 
            local_body_id, 
            ward_id || null, 
            name, 
            role_id || null, 
            gender || null, 
            age ? parseInt(age) : null,
            phone, 
            alternative_phone || null, 
            email || null, 
            house_name || null, 
            home_address || null,
            location ? JSON.stringify(parseJsonField(location)) : null,
            bio || null, 
            office_name || null, 
            office_phone || null, 
            office_email || null, 
            office_address || null,
            office_location ? JSON.stringify(parseJsonField(office_location)) : null,
            additional_roles ? JSON.stringify(parseJsonField(additional_roles)) : null,
            achievements ? JSON.stringify(parseJsonField(achievements)) : null,
            notes ? JSON.stringify(parseJsonField(notes)) : null,
            bookmarked === 'true' || bookmarked === true,
            photo_url,
            department || null,
            head_name || null,
            hours || null,
            avatar_color || null,
            officer_phone || null,
            status || 'Active'
        ]);

        const [rows] = await db.query('SELECT * FROM governing_representatives WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Governing body representative created successfully.', 201);
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return errorResponse(res, 'Foreign key constraint failed. Check local_body_id, ward_id, or role_id.', 400);
        }
        console.error('[createGoverningBody]', error);
        return errorResponse(res, 'Server error creating representative.');
    }
};

// PUT /api/admin/governing-bodies/:id
export const updateGoverningBody = async (req, res) => {
    try {
        await runMulter(uploadGoverningBodyPhoto, req, res);

        const { id } = req.params;
        const errorMsg = validateBody(req.body);
        if (errorMsg) return errorResponse(res, errorMsg, 400);

        const {
            governing_body_type, local_body_id, ward_id, name, role_id, gender, age, 
            phone, alternative_phone, email, house_name, home_address, location, 
            bio, office_name, office_phone, office_email, office_address, office_location, 
            additional_roles, achievements, notes, bookmarked,
            department, head_name, hours, avatar_color, officer_phone, status
        } = req.body;

        const [[existing]] = await db.query('SELECT photo_url FROM governing_representatives WHERE id = ?', [id]);
        if (!existing) {
            return errorResponse(res, 'Governing body representative not found.', 404);
        }

        const photo_url = req.file ? req.file.location : existing.photo_url;

        await db.query(`
            UPDATE governing_representatives SET
                governing_body_type = ?, local_body_id = ?, ward_id = ?, name = ?, role_id = ?, gender = ?, age = ?,
                phone = ?, alternative_phone = ?, email = ?, house_name = ?, home_address = ?, location = ?,
                bio = ?, office_name = ?, office_phone = ?, office_email = ?, office_address = ?, office_location = ?,
                additional_roles = ?, achievements = ?, notes = ?, bookmarked = ?, photo_url = ?,
                department = ?, head_name = ?, hours = ?, avatar_color = ?, officer_phone = ?, status = COALESCE(?, status)
            WHERE id = ?
        `, [
            governing_body_type, 
            local_body_id, 
            ward_id || null, 
            name, 
            role_id || null, 
            gender || null, 
            age ? parseInt(age) : null,
            phone, 
            alternative_phone || null, 
            email || null, 
            house_name || null, 
            home_address || null,
            location ? JSON.stringify(parseJsonField(location)) : null,
            bio || null, 
            office_name || null, 
            office_phone || null, 
            office_email || null, 
            office_address || null,
            office_location ? JSON.stringify(parseJsonField(office_location)) : null,
            additional_roles ? JSON.stringify(parseJsonField(additional_roles)) : null,
            achievements ? JSON.stringify(parseJsonField(achievements)) : null,
            notes ? JSON.stringify(parseJsonField(notes)) : null,
            bookmarked === 'true' || bookmarked === true,
            photo_url,
            department || null,
            head_name || null,
            hours || null,
            avatar_color || null,
            officer_phone || null,
            status || null,
            id
        ]);

        const [rows] = await db.query('SELECT * FROM governing_representatives WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Governing body representative updated successfully.');
    } catch (error) {
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return errorResponse(res, 'Foreign key constraint failed. Check local_body_id, ward_id, or role_id.', 400);
        }
        console.error('[updateGoverningBody]', error);
        return errorResponse(res, 'Server error updating representative.');
    }
};

// DELETE /api/admin/governing-bodies/:id  (permanent delete — requires ?force=true)
export const deleteGoverningBody = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        if (force !== 'true') {
            return errorResponse(res, 'Permanent deletion requires ?force=true. Use PATCH /trash to soft-delete.', 400);
        }

        const [result] = await db.query('DELETE FROM governing_representatives WHERE id = ?', [id]);
        
        if (!result.affectedRows) {
            return errorResponse(res, 'Governing body representative not found.', 404);
        }

        return successResponse(res, null, 'Governing body representative permanently deleted.');
    } catch (error) {
        console.error('[deleteGoverningBody]', error);
        return errorResponse(res, 'Server error deleting representative.');
    }
};

// PATCH /api/admin/governing-bodies/:id/trash  (soft delete)
export const trashGoverningBody = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'UPDATE governing_representatives SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
            [id]
        );
        if (!result.affectedRows) {
            return errorResponse(res, 'Representative not found or already trashed.', 404);
        }
        return successResponse(res, null, 'Representative moved to trash.');
    } catch (error) {
        console.error('[trashGoverningBody]', error);
        return errorResponse(res, 'Server error trashing representative.');
    }
};

// PATCH /api/admin/governing-bodies/:id/restore  (restore from trash)
export const restoreGoverningBody = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'UPDATE governing_representatives SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND is_deleted = 1',
            [id]
        );
        if (!result.affectedRows) {
            return errorResponse(res, 'Representative not found in trash.', 404);
        }
        return successResponse(res, null, 'Representative restored successfully.');
    } catch (error) {
        console.error('[restoreGoverningBody]', error);
        return errorResponse(res, 'Server error restoring representative.');
    }
};

// PATCH toggle bookmark status
export const toggleBookmark = async (req, res) => {
    try {
        const { id } = req.params;
        const { bookmarked } = req.body;

        if (typeof bookmarked !== 'boolean') {
            return errorResponse(res, 'bookmarked boolean field is required.', 400);
        }

        const [result] = await db.query('UPDATE governing_representatives SET bookmarked = ? WHERE id = ?', [bookmarked, id]);
        
        if (!result.affectedRows) {
            return errorResponse(res, 'Governing body representative not found.', 404);
        }

        const [rows] = await db.query('SELECT * FROM governing_representatives WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Bookmark status updated successfully.');
    } catch (error) {
        console.error('[toggleBookmark]', error);
        return errorResponse(res, 'Server error updating bookmark status.');
    }
};

