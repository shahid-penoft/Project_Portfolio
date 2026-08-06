import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';

// GET /api/local-bodies/with-wards
export const getLocalBodiesWithWards = async (req, res) => {
    try {
        const { includeAll } = req.query;
        let lbQuery = 'SELECT * FROM local_bodies';
        if (!includeAll || includeAll === 'false') {
            lbQuery += " WHERE type IS NULL OR type NOT IN ('BLOCK_PANCHAYAT', 'DISTRICT_PANCHAYAT')";
        }
        lbQuery += ' ORDER BY name ASC';
        
        const [localBodies] = await db.query(lbQuery);
        const [wards] = await db.query('SELECT * FROM local_body_wards ORDER BY CAST(ward_no AS UNSIGNED) ASC, ward_no ASC');

        const wardsByLocalBody = {};
        const formattedAllWards = [];

        wards.forEach(w => {
            const lb = localBodies.find(l => l.id === w.local_body_id);
            const lbName = lb ? lb.name : '';
            formattedAllWards.push({
                id: String(w.id),
                ward_no: w.ward_no,
                place_name: w.place_name,
                local_body_id: String(w.local_body_id),
                local_body_name: lbName,
                label: `Ward ${w.ward_no}${w.place_name ? ` - ${w.place_name}` : ''}${lbName ? ` (${lbName})` : ''}`,
                value: String(w.id)
            });

            if (!wardsByLocalBody[w.local_body_id]) {
                wardsByLocalBody[w.local_body_id] = [];
            }
            wardsByLocalBody[w.local_body_id].push(w);
        });

        const structuredLocalBodies = localBodies.map(lb => {
            const lbWards = wardsByLocalBody[lb.id] || [];
            return {
                ...lb,
                wards: lbWards,
                wardsCount: lbWards.length,
                wardsLabel: `${lbWards.length} Wards`
            };
        });

        return successResponse(res, {
            data: structuredLocalBodies,
            allWards: formattedAllWards
        }, 'Local bodies with wards fetched successfully.');
    } catch (err) {
        console.error('[getLocalBodiesWithWards]', err);
        return errorResponse(res, 'Server error fetching local bodies with wards.');
    }
};

// GET /api/local-bodies
export const getAllLocalBodies = async (req, res) => {
    try {
        const { page, limit, search, includeAll } = req.query;

        let baseWhere = '1=1';
        if (!includeAll || includeAll === 'false') {
            baseWhere = "(type IS NULL OR type NOT IN ('BLOCK_PANCHAYAT', 'DISTRICT_PANCHAYAT'))";
        }

        // If no pagination params are provided, maintain legacy behavior (fetch all)
        if (!page || !limit) {
            let queryStr = `SELECT * FROM local_bodies WHERE ${baseWhere}`;
            const params = [];
            if (search) {
                queryStr += ' AND (name LIKE ? OR description LIKE ? OR short_description LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }
            queryStr += ' ORDER BY name ASC';
            const [rows] = await db.query(queryStr, params);
            return successResponse(res, { data: rows }, 'Local bodies fetched successfully.');
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        let query = `SELECT * FROM local_bodies WHERE ${baseWhere}`;
        let countQuery = `SELECT COUNT(*) as total FROM local_bodies WHERE ${baseWhere}`;
        const queryParams = [];

        if (search) {
            query += ' AND (name LIKE ? OR description LIKE ? OR short_description LIKE ?)';
            countQuery += ' AND (name LIKE ? OR description LIKE ? OR short_description LIKE ?)';
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY name ASC LIMIT ? OFFSET ?';

        const [rows] = await db.query(query, [...queryParams, limitNum, offset]);
        const [countResult] = await db.query(countQuery, queryParams);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limitNum);

        return successResponse(res, {
            data: rows,
            pagination: { total, page: pageNum, limit: limitNum, totalPages }
        }, 'Local bodies fetched successfully.');
    } catch (err) {
        console.error('[getAllLocalBodies]', err);
        return errorResponse(res, 'Server error fetching local bodies.');
    }
};

// POST /api/local-bodies
export const createLocalBody = async (req, res) => {
    try {
        const { name, description, short_description, cover_image, population, area, type, headquarters, office_address, office_phone, office_email, office_working_hours, office_google_maps_url } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'INSERT INTO local_bodies (name, description, short_description, cover_image, population, area, type, headquarters, office_address, office_phone, office_email, office_working_hours, office_google_maps_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name.trim(), description || null, short_description || null, cover_image || null, population || null, area || null, type || null, headquarters || null, office_address || null, office_phone || null, office_email || null, office_working_hours ? JSON.stringify(office_working_hours) : null, office_google_maps_url || null]
        );
        const [rows] = await db.query('SELECT * FROM local_bodies WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Local body created successfully.', 201);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A local body with this name already exists.', 409);
        console.error('[createLocalBody]', err);
        return errorResponse(res, 'Server error creating local body.');
    }
};

// PUT /api/local-bodies/:id
export const updateLocalBody = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, short_description, cover_image, population, area, type, headquarters, office_address, office_phone, office_email, office_working_hours, office_google_maps_url } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'UPDATE local_bodies SET name = ?, description = ?, short_description = ?, cover_image = ?, population = ?, area = ?, type = ?, headquarters = ?, office_address = ?, office_phone = ?, office_email = ?, office_working_hours = ?, office_google_maps_url = ? WHERE id = ?',
            [name.trim(), description || null, short_description || null, cover_image || null, population || null, area || null, type || null, headquarters || null, office_address || null, office_phone || null, office_email || null, office_working_hours ? JSON.stringify(office_working_hours) : null, office_google_maps_url || null, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Local body not found.', 404);
        const [rows] = await db.query('SELECT * FROM local_bodies WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Local body updated successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A local body with this name already exists.', 409);
        console.error('[updateLocalBody]', err);
        return errorResponse(res, 'Server error updating local body.');
    }
};

// POST /api/local-bodies/upload
export const uploadLocalBodyImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: req.file.location || `/uploads/${req.file.filename}` }, 'Image uploaded.');
    } catch (err) {
        console.error('[uploadLocalBodyImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// DELETE /api/local-bodies/:id
export const deleteLocalBody = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM local_bodies WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return errorResponse(res, 'Local body not found.', 404);
        return successResponse(res, {}, 'Local body deleted successfully.');
    } catch (err) {
        console.error('[deleteLocalBody]', err);
        return errorResponse(res, 'Server error deleting local body.');
    }
};

// GET /api/local-bodies/public/:id
export const getPublicLocalBodyById = async (req, res) => {
    try {
        const { id } = req.params;
        const [lbRows] = await db.query('SELECT * FROM local_bodies WHERE id = ?', [id]);
        if (lbRows.length === 0) return errorResponse(res, 'Local body not found.', 404);
        const lb = lbRows[0];

        // Fetch President & Secretary
        const [reps] = await db.query(`
            SELECT gr.name, gr.phone, m.label as designation, gr.role_id
            FROM governing_representatives gr
            LEFT JOIN mla_dropdown_lists m ON gr.role_id = m.id
            WHERE gr.local_body_id = ? AND gr.is_deleted = FALSE AND (m.label = 'President' OR m.label = 'Chairperson' OR m.label = 'Secretary')
        `, [id]);
        
        let president = null;
        let secretary = null;
        reps.forEach(rep => {
            if (rep.designation === 'President' || rep.designation === 'Chairperson') president = rep;
            else if (rep.designation === 'Secretary') secretary = rep;
        });

        // Fetch Wards
        const [wards] = await db.query(`
            SELECT w.id as ward_id, w.ward_no, w.place_name, gr.name as member_name, gr.phone as member_phone
            FROM local_body_wards w
            LEFT JOIN governing_representatives gr ON w.id = gr.ward_id AND gr.is_deleted = FALSE
            WHERE w.local_body_id = ?
            ORDER BY CAST(w.ward_no AS UNSIGNED) ASC, w.ward_no ASC
        `, [id]);

        const formattedWards = wards.map(w => ({
            number: w.ward_no,
            name: w.place_name,
            member: w.member_name || 'N/A',
            phone: w.member_phone || 'N/A'
        }));

        // Try to parse office working hours
        let parsedHours = null;
        if (lb.office_working_hours) {
            try { parsedHours = typeof lb.office_working_hours === 'string' ? JSON.parse(lb.office_working_hours) : lb.office_working_hours; } catch(e){}
        }

        const data = {
            id: lb.id,
            name: lb.name,
            type: lb.type,
            description: lb.description,
            wardsLabel: `${wards.length} Wards`,
            wardsCount: wards.length,
            population: lb.population,
            area: lb.area,
            headquarters: lb.headquarters,
            coverImage: lb.cover_image,
            president,
            secretary,
            officeContact: {
                address: lb.office_address,
                phone: lb.office_phone,
                email: lb.office_email,
                workingHours: parsedHours,
                googleMapsUrl: lb.office_google_maps_url
            },
            wards: formattedWards,
            projects: [],
            landmarks: []
        };

        return successResponse(res, { data }, 'Local body details fetched successfully.');
    } catch (err) {
        console.error('[getPublicLocalBodyById]', err);
        return errorResponse(res, 'Server error fetching local body details.');
    }
};
