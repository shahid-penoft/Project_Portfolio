import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadGeoLocationMedia, uploadGeoLocationAttachments } from '../configs/multerS3.js';

/**
 * GET /api/geo-locations
 * Fetches all geo locations with search, filters, and pagination.
 */
export const getAllGeoLocations = async (req, res) => {
    try {
        const { 
            page = 1, limit = 12, search, 
            type, category, sub_category, ward, 
            status = 'published', bookmarked_by_admin
        } = req.query;

        const offset = (page - 1) * limit;
        const queryParams = [];
        const countParams = [];

        let baseQuery = `
            SELECT g.*, 
                (SELECT url FROM geo_location_images WHERE location_id = g.id ORDER BY display_order ASC LIMIT 1) AS cover_image,
                (SELECT COUNT(*) FROM geo_location_images WHERE location_id = g.id) AS image_count,
                (SELECT COUNT(*) FROM geo_location_attachments WHERE location_id = g.id) AS attachment_count,
                CONCAT(cb.full_name, ' (USR', LPAD(cb.id,4,'0'), ')') AS created_by_name,
                CONCAT(ub.full_name, ' (USR', LPAD(ub.id,4,'0'), ')') AS updated_by_name
        `;
        
        if (req.admin) {
            baseQuery += `, (SELECT 1 FROM admin_geo_location_bookmarks WHERE location_id = g.id AND admin_id = ${Number(req.admin.id)}) AS bookmarked`;
        }

        baseQuery += `
            FROM geo_locations g
            LEFT JOIN admin_users cb ON g.created_by = cb.id
            LEFT JOIN admin_users ub ON g.updated_by = ub.id
            WHERE 1=1
        `;

        let countQuery = `SELECT COUNT(*) as total FROM geo_locations g WHERE 1=1`;

        // Apply filters
        if (status) {
            baseQuery += ` AND g.status = ?`;
            countQuery += ` AND g.status = ?`;
            queryParams.push(status);
            countParams.push(status);
        }

        if (type && type !== 'All') {
            baseQuery += ` AND g.type = ?`;
            countQuery += ` AND g.type = ?`;
            queryParams.push(type);
            countParams.push(type);
        }

        if (category && category !== 'All') {
            baseQuery += ` AND g.category = ?`;
            countQuery += ` AND g.category = ?`;
            queryParams.push(category);
            countParams.push(category);
        }

        if (sub_category && sub_category !== 'All') {
            baseQuery += ` AND g.sub_category = ?`;
            countQuery += ` AND g.sub_category = ?`;
            queryParams.push(sub_category);
            countParams.push(sub_category);
        }

        if (ward && ward !== 'All') {
            baseQuery += ` AND g.ward = ?`;
            countQuery += ` AND g.ward = ?`;
            queryParams.push(ward);
            countParams.push(ward);
        }

        // Only used by Admin if they want to filter bookmarks
        if (bookmarked_by_admin === 'true') {
            if (!req.admin) {
                return errorResponse(res, 'Unauthorized to view admin bookmarks', 401);
            }
            baseQuery += ` AND EXISTS (SELECT 1 FROM admin_geo_location_bookmarks WHERE location_id = g.id AND admin_id = ${Number(req.admin.id)})`;
            countQuery += ` AND EXISTS (SELECT 1 FROM admin_geo_location_bookmarks WHERE location_id = g.id AND admin_id = ${Number(req.admin.id)})`;
        }

        if (search) {
            const searchTerm = `%${search}%`;
            baseQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.landmark LIKE ? OR g.full_address LIKE ? OR g.description LIKE ?)`;
            countQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.landmark LIKE ? OR g.full_address LIKE ? OR g.description LIKE ?)`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        baseQuery += ` ORDER BY g.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(Number(limit), Number(offset));

        const [rows] = await db.query(baseQuery, queryParams);
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        // Also get global stats for the cards
        const [statsRows] = await db.query(`
            SELECT category, COUNT(*) as count 
            FROM geo_locations 
            WHERE status = ? 
            GROUP BY category
        `, [status]);

        const stats = { total };
        statsRows.forEach(row => {
            if (row.category) {
                stats[row.category] = row.count;
            }
        });

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            },
            stats
        });
    } catch (error) {
        console.error('[getAllGeoLocations]', error);
        return errorResponse(res, 'Failed to fetch geo locations.');
    }
};

/**
 * GET /api/geo-locations/stats
 * Fetches stats independent of the list, including ward coverage and weekly additions.
 */
export const getGeoLocationStats = async (req, res) => {
    try {
        const [categoryRows] = await db.query(`
            SELECT category, COUNT(*) as count 
            FROM geo_locations 
            WHERE status = 'published' 
            GROUP BY category
        `);

        const [totalRow] = await db.query(
            `SELECT COUNT(*) as total FROM geo_locations WHERE status = 'published'`
        );

        const [wardRow] = await db.query(
            `SELECT COUNT(DISTINCT ward) as wardsCount FROM geo_locations WHERE status = 'published' AND ward IS NOT NULL AND ward != ''`
        );

        const [weekRow] = await db.query(
            `SELECT COUNT(*) as addedThisWeek FROM geo_locations WHERE status = 'published' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );

        const [mappedRow] = await db.query(
            `SELECT COUNT(*) as mappedCount FROM geo_locations WHERE status = 'published' AND coordinates IS NOT NULL AND coordinates != ''`
        );

        const stats = {
            total: totalRow[0].total,
            wardsCount: wardRow[0].wardsCount,
            addedThisWeek: weekRow[0].addedThisWeek,
            mappedCount: mappedRow[0].mappedCount,
            categoryCounts: {}
        };

        categoryRows.forEach(row => {
            if (row.category) {
                stats.categoryCounts[row.category] = row.count;
            }
        });

        return successResponse(res, stats);
    } catch (error) {
        console.error('[getGeoLocationStats]', error);
        return errorResponse(res, 'Failed to fetch stats.');
    }
};

/**
 * GET /api/geo-locations/map-data
 * Returns a lightweight list of all published locations that have GPS
 * coordinates stored. Only returns fields needed to render map markers.
 */
export const getGeoLocationMapData = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                g.id, g.name, g.category, g.sub_category, g.type, g.coordinates,
                (SELECT url FROM geo_location_images WHERE location_id = g.id ORDER BY display_order ASC LIMIT 1) AS cover_image
            FROM geo_locations g
            WHERE g.status = 'published'
              AND g.coordinates IS NOT NULL
              AND g.coordinates != ''
            ORDER BY g.created_at DESC
        `);
        return res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('[getGeoLocationMapData]', error);
        return errorResponse(res, 'Failed to fetch map data.');
    }
};

/**
 * GET /api/geo-locations/:id
 * Fetch single geo location by ID with images and attachments.
 */
export const getGeoLocationById = async (req, res) => {
    try {
        const { id } = req.params;
        let query = `
            SELECT g.*,
                CONCAT(cb.full_name, ' (USR', LPAD(cb.id,4,'0'), ')') AS created_by_name,
                CONCAT(ub.full_name, ' (USR', LPAD(ub.id,4,'0'), ')') AS updated_by_name,
                lb.name AS local_body_name,
                lbw.ward_no AS ward_number,
                lbw.place_name AS ward_place_name
        `;
        if (req.admin) {
            query += `, (SELECT 1 FROM admin_geo_location_bookmarks WHERE location_id = g.id AND admin_id = ${Number(req.admin.id)}) AS bookmarked`;
        }
        query += `
            FROM geo_locations g
            LEFT JOIN admin_users cb ON g.created_by = cb.id
            LEFT JOIN admin_users ub ON g.updated_by = ub.id
            LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
            LEFT JOIN local_body_wards lbw ON lbw.local_body_id = g.local_body_id AND CAST(lbw.ward_no AS CHAR) = CAST(g.ward AS CHAR)
            WHERE g.id = ?
        `;
        const [rows] = await db.query(query, [id]);

        if (rows.length === 0) {
            return errorResponse(res, 'Geo location not found.', 404);
        }

        const location = rows[0];

        const [images] = await db.query(`SELECT * FROM geo_location_images WHERE location_id = ? ORDER BY display_order ASC`, [id]);
        const [attachments] = await db.query(`SELECT * FROM geo_location_attachments WHERE location_id = ? ORDER BY created_at DESC`, [id]);

        location.images = images;
        location.attachments = attachments;

        return successResponse(res, location);
    } catch (error) {
        console.error('[getGeoLocationById]', error);
        return errorResponse(res, 'Failed to fetch location details.');
    }
};

/**
 * POST /api/geo-locations/:id/bookmark
 * Toggles a bookmark for the current constituent user.
 */
export const toggleBookmark = async (req, res) => {
    try {
        const { id } = req.params;
        const constituentId = req.constituent.id; // From verifyConstituentToken

        const [existing] = await db.query(
            `SELECT id FROM geo_location_bookmarks WHERE location_id = ? AND constituent_id = ?`,
            [id, constituentId]
        );

        if (existing.length > 0) {
            // Remove bookmark
            await db.query(`DELETE FROM geo_location_bookmarks WHERE id = ?`, [existing[0].id]);
            return successResponse(res, { bookmarked: false }, 'Bookmark removed.');
        } else {
            // Add bookmark
            await db.query(
                `INSERT INTO geo_location_bookmarks (location_id, constituent_id) VALUES (?, ?)`,
                [id, constituentId]
            );
            return successResponse(res, { bookmarked: true }, 'Location bookmarked.');
        }
    } catch (error) {
        console.error('[toggleBookmark]', error);
        return errorResponse(res, 'Failed to toggle bookmark.');
    }
};

/**
 * POST /api/geo-locations/:id/admin-bookmark
 * Toggles a bookmark for the current Admin user.
 */
export const toggleAdminBookmark = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin.id; // From verifyToken

        const [existing] = await db.query(
            `SELECT id FROM admin_geo_location_bookmarks WHERE location_id = ? AND admin_id = ?`,
            [id, adminId]
        );

        if (existing.length > 0) {
            // Remove bookmark
            await db.query(`DELETE FROM admin_geo_location_bookmarks WHERE id = ?`, [existing[0].id]);
            return successResponse(res, { bookmarked: false }, 'Bookmark removed.');
        } else {
            // Add bookmark
            await db.query(
                `INSERT INTO admin_geo_location_bookmarks (location_id, admin_id) VALUES (?, ?)`,
                [id, adminId]
            );
            return successResponse(res, { bookmarked: true }, 'Location bookmarked.');
        }
    } catch (error) {
        console.error('[toggleAdminBookmark]', error);
        return errorResponse(res, 'Failed to toggle admin bookmark.');
    }
};


/**
 * GET /api/geo-locations/my-bookmarks
 * Fetches bookmarked locations for the current constituent user.
 */
export const getMyBookmarks = async (req, res) => {
    try {
        const constituentId = req.constituent.id;
        const { page = 1, limit = 12, search, type, category, sub_category, ward } = req.query;
        const offset = (page - 1) * limit;

        let baseQuery = `
            SELECT g.*, 
                (SELECT url FROM geo_location_images WHERE location_id = g.id ORDER BY display_order ASC LIMIT 1) AS cover_image,
                (SELECT COUNT(*) FROM geo_location_images WHERE location_id = g.id) AS image_count,
                (SELECT COUNT(*) FROM geo_location_attachments WHERE location_id = g.id) AS attachment_count
            FROM geo_locations g
            INNER JOIN geo_location_bookmarks b ON g.id = b.location_id
            WHERE b.constituent_id = ? AND g.status = 'published'
        `;

        let countQuery = `
            SELECT COUNT(*) as total 
            FROM geo_locations g 
            INNER JOIN geo_location_bookmarks b ON g.id = b.location_id 
            WHERE b.constituent_id = ? AND g.status = 'published'
        `;

        const queryParams = [constituentId];
        const countParams = [constituentId];

        // Apply filters
        if (type && type !== 'All') {
            baseQuery += ` AND g.type = ?`;
            countQuery += ` AND g.type = ?`;
            queryParams.push(type);
            countParams.push(type);
        }
        if (category && category !== 'All') {
            baseQuery += ` AND g.category = ?`;
            countQuery += ` AND g.category = ?`;
            queryParams.push(category);
            countParams.push(category);
        }
        if (ward && ward !== 'All') {
            baseQuery += ` AND g.ward = ?`;
            countQuery += ` AND g.ward = ?`;
            queryParams.push(ward);
            countParams.push(ward);
        }
        if (search) {
            const searchTerm = `%${search}%`;
            baseQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.landmark LIKE ?)`;
            countQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.landmark LIKE ?)`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        baseQuery += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(Number(limit), Number(offset));

        const [rows] = await db.query(baseQuery, queryParams);
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        // Stats for bookmarked
        const [statsRows] = await db.query(`
            SELECT g.category, COUNT(*) as count 
            FROM geo_locations g
            INNER JOIN geo_location_bookmarks b ON g.id = b.location_id
            WHERE b.constituent_id = ? AND g.status = 'published'
            GROUP BY g.category
        `, [constituentId]);

        const stats = { total };
        statsRows.forEach(row => {
            if (row.category) stats[row.category] = row.count;
        });

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            },
            stats
        });
    } catch (error) {
        console.error('[getMyBookmarks]', error);
        return errorResponse(res, 'Failed to fetch bookmarks.');
    }
};

/**
 * DELETE /api/geo-locations/:id
 * Delete a geo location and its related records.
 */
export const deleteGeoLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(`DELETE FROM geo_locations WHERE id = ?`, [id]);
        
        if (result.affectedRows === 0) {
            return errorResponse(res, 'Geo location not found.', 404);
        }

        return successResponse(res, null, 'Geo location deleted successfully.');
    } catch (error) {
        console.error('[deleteGeoLocation]', error);
        return errorResponse(res, 'Failed to delete geo location.');
    }
};

/**
 * POST /api/geo-locations
 * Create a new geo location.
 */
export const createGeoLocation = async (req, res) => {
    try {
        const {
            type, name, category, sub_category, established_year, phone,
            any_history, history_details, local_body_id, ward, landmark, full_address,
            coordinates, digipin, contact_person, contact_role, contact_number,
            alt_number, operating_hours, website, facilities, description,
            is_operational, is_public_access, has_parking, has_wheelchair, status
        } = req.body;

        if (!name || !type) {
            return errorResponse(res, 'Name and Type are required.', 400);
        }

        const adminId = req.admin ? req.admin.id : null;

        const [result] = await db.query(
            `INSERT INTO geo_locations (
                type, name, category, sub_category, established_year, phone,
                any_history, history_details, local_body_id, ward, landmark, full_address,
                coordinates, digipin, contact_person, contact_role, contact_number,
                alt_number, operating_hours, website, facilities, description,
                is_operational, is_public_access, has_parking, has_wheelchair, status, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                type, name, category || null, sub_category || null, established_year || null, phone || null,
                any_history || 'No', history_details || null, local_body_id || null, ward || null, landmark || null, full_address || null,
                coordinates || null, digipin || null, contact_person || null, contact_role || null, contact_number || null,
                alt_number || null, operating_hours || null, website || null, facilities || null, description || null,
                is_operational !== undefined ? is_operational : 1, 
                is_public_access !== undefined ? is_public_access : 1, 
                has_parking !== undefined ? has_parking : 0, 
                has_wheelchair !== undefined ? has_wheelchair : 0,
                status || 'published', adminId, adminId
            ]
        );

        const [[newLoc]] = await db.query(`SELECT * FROM geo_locations WHERE id = ?`, [result.insertId]);
        return successResponse(res, newLoc, 'Geo location created successfully.', 201);
    } catch (error) {
        console.error('[createGeoLocation]', error);
        return errorResponse(res, 'Failed to create geo location.');
    }
};

/**
 * PUT /api/geo-locations/:id
 * Update an existing geo location.
 */
export const updateGeoLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            type, name, category, sub_category, established_year, phone,
            any_history, history_details, local_body_id, ward, landmark, full_address,
            coordinates, digipin, contact_person, contact_role, contact_number,
            alt_number, operating_hours, website, facilities, description,
            is_operational, is_public_access, has_parking, has_wheelchair, status
        } = req.body;

        const adminId = req.admin ? req.admin.id : null;

        const [result] = await db.query(
            `UPDATE geo_locations SET 
                type = ?, name = ?, category = ?, sub_category = ?, established_year = ?, phone = ?,
                any_history = ?, history_details = ?, local_body_id = ?, ward = ?, landmark = ?, full_address = ?,
                coordinates = ?, digipin = ?, contact_person = ?, contact_role = ?, contact_number = ?,
                alt_number = ?, operating_hours = ?, website = ?, facilities = ?, description = ?,
                is_operational = ?, is_public_access = ?, has_parking = ?, has_wheelchair = ?, status = ?, updated_by = ?
            WHERE id = ?`,
            [
                type, name, category || null, sub_category || null, established_year || null, phone || null,
                any_history || 'No', history_details || null, local_body_id || null, ward || null, landmark || null, full_address || null,
                coordinates || null, digipin || null, contact_person || null, contact_role || null, contact_number || null,
                alt_number || null, operating_hours || null, website || null, facilities || null, description || null,
                is_operational !== undefined ? is_operational : 1, 
                is_public_access !== undefined ? is_public_access : 1, 
                has_parking !== undefined ? has_parking : 0, 
                has_wheelchair !== undefined ? has_wheelchair : 0,
                status || 'published', adminId, id
            ]
        );

        if (result.affectedRows === 0) {
            return errorResponse(res, 'Geo location not found.', 404);
        }

        const [[updatedLoc]] = await db.query(`SELECT * FROM geo_locations WHERE id = ?`, [id]);
        return successResponse(res, updatedLoc, 'Geo location updated successfully.');
    } catch (error) {
        console.error('[updateGeoLocation]', error);
        return errorResponse(res, 'Failed to update geo location.');
    }
};

/**
 * POST /api/geo-locations/:id/upload-media
 */
export const uploadGeoLocationMediaHandler = async (req, res) => {
    try {
        const { id } = req.params;
        await runMulter(uploadGeoLocationMedia, req, res);

        if (!req.files || req.files.length === 0) {
            return errorResponse(res, 'No media files provided.', 400);
        }

        const insertedFiles = [];
        // Optional: clear existing media if needed, but usually we just append
        // Get the current max display_order
        const [[{ max_order }]] = await db.query(`SELECT MAX(display_order) as max_order FROM geo_location_images WHERE location_id = ?`, [id]);
        let nextOrder = (max_order || 0) + 1;

        for (const file of req.files) {
            const url = file.location || `/uploads/${file.filename}`;
            const filename = file.originalname;
            const size_bytes = file.size;

            const [result] = await db.query(
                `INSERT INTO geo_location_images (location_id, url, filename, size_bytes, display_order) VALUES (?, ?, ?, ?, ?)`,
                [id, url, filename, size_bytes, nextOrder++]
            );
            insertedFiles.push({ id: result.insertId, url, filename, size_bytes });
        }

        return successResponse(res, insertedFiles, 'Media uploaded successfully.', 201);
    } catch (error) {
        console.error('[uploadGeoLocationMediaHandler]', error);
        return errorResponse(res, error.message || 'Media upload failed.', 500);
    }
};

/**
 * POST /api/geo-locations/:id/upload-attachment
 */
export const uploadGeoLocationAttachmentHandler = async (req, res) => {
    try {
        const { id } = req.params;
        await runMulter(uploadGeoLocationAttachments, req, res);

        if (!req.files || req.files.length === 0) {
            return errorResponse(res, 'No attachment files provided.', 400);
        }

        const insertedFiles = [];
        for (const file of req.files) {
            const url = file.location || `/uploads/${file.filename}`;
            const name = file.originalname;
            const size_bytes = file.size;

            const [result] = await db.query(
                `INSERT INTO geo_location_attachments (location_id, name, url, size_bytes) VALUES (?, ?, ?, ?)`,
                [id, name, url, size_bytes]
            );
            insertedFiles.push({ id: result.insertId, name, url, size_bytes });
        }

        return successResponse(res, insertedFiles, 'Attachments uploaded successfully.', 201);
    } catch (error) {
        console.error('[uploadGeoLocationAttachmentHandler]', error);
        return errorResponse(res, error.message || 'Attachment upload failed.', 500);
    }
};

