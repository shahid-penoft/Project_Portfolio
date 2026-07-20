import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadGoverningBodyPhoto, runMulter } from '../configs/multerS3.js';
import { logActivity as auditLog } from './teamsLogController.js';

const parseJsonField = (field) => {
    if (!field) return null;
    try {
        if (typeof field === 'string') return JSON.parse(field);
        return field;
    } catch (e) {
        return field;
    }
};

/**
 * Parse all JSON-stored columns on a representative row before sending to client.
 * Ensures frontend receives typed arrays/objects, never raw JSON strings.
 */
const parseRepRow = (row) => {
    if (!row) return row;
    return {
        ...row,
        location:         parseJsonField(row.location),
        office_location:  parseJsonField(row.office_location),
        officeLocation:   parseJsonField(row.office_location ?? row.officeLocation),
        additional_roles: parseJsonField(row.additional_roles) ?? [],
        additionalRoles:  parseJsonField(row.additional_roles ?? row.additionalRoles) ?? [],
        achievements:     parseJsonField(row.achievements) ?? [],
        notes:            parseJsonField(row.notes) ?? [],
        otherDetails:     parseJsonField(row.notes ?? row.otherDetails) ?? [],
    };
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
        console.log('[getGoverningBodies] query:', req.query);
        const { type, localBodyId, wardId, roleId, search, bookmarked, sortBy, page, limit, trash } = req.query;

        let query = `
            SELECT 
                gr.*,
                gr.head_name       AS headName,
                gr.avatar_color    AS avatarColor,
                gr.officer_phone   AS officerPhone,
                gr.office_email    AS officeEmail,
                gr.officer_email   AS officerEmail,
                gr.office_location AS officeLocation,
                gr.alternative_phone AS alternativePhone,
                gr.house_name      AS houseName,
                gr.home_address    AS homeAddress,
                gr.office_address  AS officeAddress,
                gr.office_phone    AS officePhone,
                gr.notes           AS otherDetails,
                gr.role_id         AS roleId,
                gr.local_body_id   AS localBodyId,
                gr.ward_id         AS wardId,
                lb.name            AS localBodyName,
                lb.name            AS localBody,
                w.place_name       AS wardName,
                w.ward_no          AS wardNumber,
                CONCAT('Ward ', w.ward_no, ' - ', w.place_name) AS ward,
                r.label            AS headDesignation,
                r.label            AS roleName,
                r.label            AS role,
                (SELECT au.full_name 
                 FROM governing_body_activity_logs al 
                 LEFT JOIN admin_users au ON al.admin_user_id = au.id 
                 WHERE al.governing_body_id = gr.id AND al.text LIKE 'Created%'
                 ORDER BY al.created_at ASC LIMIT 1) AS createdBy,
                (SELECT au2.full_name FROM governing_body_activity_logs al2 LEFT JOIN admin_users au2 ON al2.admin_user_id = au2.id WHERE al2.governing_body_id = gr.id AND al2.text LIKE '%trash%' ORDER BY al2.created_at DESC LIMIT 1) AS deleted_by_name
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
            query += ' AND (gr.name LIKE ? OR gr.phone LIKE ? OR lb.name LIKE ? OR r.label LIKE ? OR w.place_name LIKE ?)';
            countQuery += ' AND (gr.name LIKE ? OR gr.phone LIKE ? OR lb.name LIKE ? OR r.label LIKE ? OR w.place_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
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
        const parsedRows = rows.map(parseRepRow);
        
        let pagination = null;
        if (page && limit) {
            const [countResult] = await db.query(countQuery, params.slice(0, params.length - 2));
            const total = countResult[0].total;
            pagination = { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
        }

        return successResponse(res, { data: parsedRows, pagination }, 'Governing bodies fetched successfully.');
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
                gr.created_at      AS createdAt,
                gr.updated_at      AS updatedAt,
                gr.head_name       AS headName,
                gr.avatar_color    AS avatarColor,
                gr.officer_phone   AS officerPhone,
                gr.office_email    AS officeEmail,
                gr.officer_email   AS officerEmail,
                gr.office_location AS officeLocation,
                gr.alternative_phone AS alternativePhone,
                gr.house_name      AS houseName,
                gr.home_address    AS homeAddress,
                gr.office_address  AS officeAddress,
                gr.office_phone    AS officePhone,
                gr.notes           AS otherDetails,
                gr.role_id         AS roleId,
                gr.local_body_id   AS localBodyId,
                gr.ward_id         AS wardId,
                lb.name            AS localBodyName,
                lb.name            AS localBody,
                w.place_name       AS wardName,
                w.ward_no          AS wardNumber,
                CONCAT('Ward ', w.ward_no, ' - ', w.place_name) AS ward,
                r.label            AS headDesignation,
                r.label            AS roleName,
                r.label            AS role
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

        const rep = parseRepRow(rows[0]);

        const [activityRows] = await db.query(`
            SELECT 
                al.id, 
                al.text, 
                al.created_at AS createdAt,
                au.full_name AS author_name
            FROM governing_body_activity_logs al
            LEFT JOIN admin_users au ON al.admin_user_id = au.id
            WHERE al.governing_body_id = ?
            ORDER BY al.created_at DESC
        `, [id]);

        rep.activity = activityRows;
        
        if (activityRows.length > 0) {
            rep.createdBy = activityRows[activityRows.length - 1].author_name || 'Admin';
            rep.updatedBy = activityRows[0].author_name || 'Admin';
        }

        return successResponse(res, { data: rep }, 'Governing body representative fetched successfully.');
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
            department, head_name, hours, avatar_color, officer_phone, officer_email, status
        } = req.body;

        const photo_url = req.file ? req.file.location : null;

        const [result] = await db.query(`
            INSERT INTO governing_representatives (
                governing_body_type, local_body_id, ward_id, name, role_id, gender, age,
                phone, alternative_phone, email, house_name, home_address, location,
                bio, office_name, office_phone, office_email, office_address, office_location,
                additional_roles, achievements, notes, bookmarked, photo_url,
                department, head_name, hours, avatar_color, officer_phone, officer_email, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            notes || null,
            bookmarked === 'true' || bookmarked === true,
            photo_url,
            department || null,
            head_name || null,
            hours || null,
            avatar_color || null,
            officer_phone || null,
            officer_email || null,
            status || 'Active'
        ]);

        if (head_name) {
            let staffDesignation = '';
            if (role_id) {
                const [[roleRow]] = await db.query('SELECT label FROM mla_dropdown_lists WHERE id = ?', [role_id]);
                if (roleRow) staffDesignation = roleRow.label;
            }
            await db.query(`
                INSERT INTO governing_body_staffs (
                    governing_body_id, name, designation, phone, email, is_key
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                result.insertId,
                head_name,
                staffDesignation,
                officer_phone || null,
                officer_email || null,
                true
            ]);
        }

        await db.query(
            'INSERT INTO governing_body_activity_logs (governing_body_id, admin_user_id, text) VALUES (?, ?, ?)',
            [result.insertId, req.admin?.id || null, 'Created the governing body representative.']
        );

        auditLog(req, { action: 'Created', module: 'Governing Body', details: `Governing body representative "${name}" created`, resource: `governing-bodies/${result.insertId}`, severity: 'info' });
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
            department, head_name, hours, avatar_color, officer_phone, officer_email, status
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
                department = ?, head_name = ?, hours = ?, avatar_color = ?, officer_phone = ?, officer_email = ?, status = COALESCE(?, status)
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
            notes || null,
            bookmarked === 'true' || bookmarked === true,
            photo_url,
            department || null,
            head_name || null,
            hours || null,
            avatar_color || null,
            officer_phone || null,
            officer_email || null,
            status || null,
            id
        ]);

        if (head_name) {
            let staffDesignation = '';
            if (role_id) {
                const [[roleRow]] = await db.query('SELECT label FROM mla_dropdown_lists WHERE id = ?', [role_id]);
                if (roleRow) staffDesignation = roleRow.label;
            }
            
            const [[existingKeyStaff]] = await db.query('SELECT id FROM governing_body_staffs WHERE governing_body_id = ? AND is_key = 1 LIMIT 1', [id]);
            
            if (existingKeyStaff) {
                await db.query(`
                    UPDATE governing_body_staffs SET
                        name = ?, designation = ?, phone = ?, email = ?
                    WHERE id = ?
                `, [
                    head_name,
                    staffDesignation,
                    officer_phone || null,
                    officer_email || null,
                    existingKeyStaff.id
                ]);
            } else {
                await db.query(`
                    INSERT INTO governing_body_staffs (
                        governing_body_id, name, designation, phone, email, is_key
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    id,
                    head_name,
                    staffDesignation,
                    officer_phone || null,
                    officer_email || null,
                    true
                ]);
            }
        }

        await db.query(
            'INSERT INTO governing_body_activity_logs (governing_body_id, admin_user_id, text) VALUES (?, ?, ?)',
            [id, req.admin?.id || null, 'Updated the governing body representative details.']
        );

        auditLog(req, { action: 'Updated', module: 'Governing Body', details: `Governing body representative ID ${id} updated`, resource: `governing-bodies/${id}`, severity: 'success' });
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

        auditLog(req, { action: 'Deleted', module: 'Governing Body', details: `Governing body representative ID ${id} permanently deleted`, resource: `governing-bodies/${id}`, severity: 'error' });
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
        auditLog(req, { action: 'Archived', module: 'Governing Body', details: `Governing body representative ID ${id} moved to trash`, resource: `governing-bodies/${id}`, severity: 'warning' });
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
        auditLog(req, { action: 'Updated', module: 'Governing Body', details: `Governing body representative ID ${id} restored from trash`, resource: `governing-bodies/${id}`, severity: 'info' });
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

// GET /api/admin/governing-bodies/stats
// Returns staff member counts per office — used by OtherOfficesPage to show memberCount badge.
// IMPORTANT: This route must be registered BEFORE /:id to avoid route collision.
export const getGoverningBodyStats = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT governing_body_id AS officeId, COUNT(*) AS memberCount
             FROM governing_body_staffs
             GROUP BY governing_body_id`
        );
        return successResponse(res, { stats: rows }, 'Stats fetched successfully.');
    } catch (error) {
        console.error('[getGoverningBodyStats]', error);
        return errorResponse(res, 'Server error fetching stats.');
    }
};
