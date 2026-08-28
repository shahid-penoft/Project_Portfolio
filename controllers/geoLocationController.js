import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadGeoLocationMedia, uploadGeoLocationAttachments } from '../configs/multerS3.js';

const parseValues = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) {
        return val.flatMap(v => typeof v === 'string' ? v.split(',') : [v]).map(v => typeof v === 'string' ? v.trim() : v).filter(Boolean);
    }
    if (typeof val === 'string') {
        return val.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [val];
};

/**
 * GET /api/geo-locations
 * Fetches all geo locations with search, filters, and pagination.
 */
export const getAllGeoLocations = async (req, res) => {
    try {
        const { 
            page = 1, limit = 12, search, 
            type, types,
            category, categories,
            sub_category, sub_categories, subCategory, subCategories,
            local_body_id, local_bodies, localBody, localBodies,
            ward, wards, 
            status = 'published', bookmarked_by_admin, 
            is_tourist_place, touristPlace,
            is_operational, operationalStatus,
            is_public_access, publicAccess,
            has_parking, parking,
            has_wheelchair, wheelchairAccess,
            any_history, anyHistory
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
                CONCAT(ub.full_name, ' (USR', LPAD(ub.id,4,'0'), ')') AS updated_by_name,
                lb.name AS local_body_name,
                lbw.ward_no AS ward_number,
                lbw.place_name AS ward_place_name
        `;
        
        if (req.admin) {
            baseQuery += `, (SELECT 1 FROM admin_geo_location_bookmarks WHERE location_id = g.id AND admin_id = ${Number(req.admin.id)}) AS bookmarked`;
        }

        baseQuery += `
            FROM geo_locations g
            LEFT JOIN admin_users cb ON g.created_by = cb.id
            LEFT JOIN admin_users ub ON g.updated_by = ub.id
            LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
            LEFT JOIN local_body_wards lbw ON lbw.local_body_id = g.local_body_id AND (CAST(lbw.ward_no AS CHAR) = CAST(g.ward AS CHAR) OR g.ward = CONCAT('Ward ', lbw.ward_no) OR (lbw.place_name IS NOT NULL AND g.ward = lbw.place_name))
            WHERE 1=1
        `;

        let countQuery = `
            SELECT COUNT(*) as total 
            FROM geo_locations g 
            LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
            LEFT JOIN local_body_wards lbw ON lbw.local_body_id = g.local_body_id AND (CAST(lbw.ward_no AS CHAR) = CAST(g.ward AS CHAR) OR g.ward = CONCAT('Ward ', lbw.ward_no) OR (lbw.place_name IS NOT NULL AND g.ward = lbw.place_name))
            WHERE 1=1
        `;

        // Apply Status Filter
        if (status) {
            baseQuery += ` AND g.status = ?`;
            countQuery += ` AND g.status = ?`;
            queryParams.push(status);
            countParams.push(status);
        }

        // Location Types
        const typeVals = parseValues(types || type).filter(v => v !== 'All');
        if (typeVals.length === 1) {
            baseQuery += ` AND g.type = ?`;
            countQuery += ` AND g.type = ?`;
            queryParams.push(typeVals[0]);
            countParams.push(typeVals[0]);
        } else if (typeVals.length > 1) {
            const placeholders = typeVals.map(() => '?').join(',');
            baseQuery += ` AND g.type IN (${placeholders})`;
            countQuery += ` AND g.type IN (${placeholders})`;
            queryParams.push(...typeVals);
            countParams.push(...typeVals);
        }

        // Categories
        const catVals = parseValues(categories || category).filter(v => v !== 'All');
        if (catVals.length === 1) {
            baseQuery += ` AND g.category = ?`;
            countQuery += ` AND g.category = ?`;
            queryParams.push(catVals[0]);
            countParams.push(catVals[0]);
        } else if (catVals.length > 1) {
            const placeholders = catVals.map(() => '?').join(',');
            baseQuery += ` AND g.category IN (${placeholders})`;
            countQuery += ` AND g.category IN (${placeholders})`;
            queryParams.push(...catVals);
            countParams.push(...catVals);
        }

        // Sub Categories
        const subCatVals = parseValues(subCategories || subCategory || sub_categories || sub_category).filter(v => v !== 'All');
        if (subCatVals.length === 1) {
            baseQuery += ` AND g.sub_category = ?`;
            countQuery += ` AND g.sub_category = ?`;
            queryParams.push(subCatVals[0]);
            countParams.push(subCatVals[0]);
        } else if (subCatVals.length > 1) {
            const placeholders = subCatVals.map(() => '?').join(',');
            baseQuery += ` AND g.sub_category IN (${placeholders})`;
            countQuery += ` AND g.sub_category IN (${placeholders})`;
            queryParams.push(...subCatVals);
            countParams.push(...subCatVals);
        }

        // Local Bodies (by ID or name)
        const lbVals = parseValues(localBodies || localBody || local_bodies || local_body_id).filter(v => v !== 'All');
        if (lbVals.length > 0) {
            const isAllNumeric = lbVals.every(v => !isNaN(Number(v)));
            const placeholders = lbVals.map(() => '?').join(',');
            if (isAllNumeric) {
                baseQuery += ` AND g.local_body_id IN (${placeholders})`;
                countQuery += ` AND g.local_body_id IN (${placeholders})`;
                queryParams.push(...lbVals.map(Number));
                countParams.push(...lbVals.map(Number));
            } else {
                baseQuery += ` AND lb.name IN (${placeholders})`;
                countQuery += ` AND lb.name IN (${placeholders})`;
                queryParams.push(...lbVals);
                countParams.push(...lbVals);
            }
        }

        // Wards (handles "Ward 5", "5", "39_5", place names, etc.)
        const rawWardVals = parseValues(wards || ward).filter(v => v !== 'All');
        if (rawWardVals.length > 0) {
            const wardClauses = [];
            for (const rawW of rawWardVals) {
                const str = String(rawW).trim();
                if (str.includes('_')) {
                    const [lbId, wNo] = str.split('_');
                    const match = wNo.match(/\d+/);
                    const cleanD = match ? match[0] : wNo;
                    wardClauses.push(`(g.local_body_id = ? AND (g.ward = ? OR g.ward = ? OR g.ward LIKE ? OR lbw.ward_no = ?))`);
                    queryParams.push(Number(lbId), cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD);
                    countParams.push(Number(lbId), cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD);
                } else {
                    const match = str.match(/\d+/);
                    const cleanD = match ? match[0] : str;
                    wardClauses.push(`(g.ward = ? OR g.ward = ? OR g.ward LIKE ? OR lbw.ward_no = ? OR (lbw.place_name IS NOT NULL AND lbw.place_name LIKE ?))`);
                    queryParams.push(cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD, `%${str}%`);
                    countParams.push(cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD, `%${str}%`);
                }
            }
            if (wardClauses.length > 0) {
                baseQuery += ` AND (${wardClauses.join(' OR ')})`;
                countQuery += ` AND (${wardClauses.join(' OR ')})`;
            }
        }

        // Admin Bookmarked
        if (bookmarked_by_admin === 'true' || bookmarked_by_admin === true) {
            if (!req.admin) {
                return errorResponse(res, 'Unauthorized to view admin bookmarks', 401);
            }
            baseQuery += ` AND EXISTS (SELECT 1 FROM admin_geo_location_bookmarks WHERE location_id = g.id AND admin_id = ${Number(req.admin.id)})`;
            countQuery += ` AND EXISTS (SELECT 1 FROM admin_geo_location_bookmarks WHERE location_id = g.id AND admin_id = ${Number(req.admin.id)})`;
        }

        // Tourist Place
        const touristVal = is_tourist_place !== undefined ? is_tourist_place : touristPlace;
        if (touristVal !== undefined && touristVal !== '') {
            const isTourist = touristVal === 'true' || touristVal === '1' || touristVal === 1 || touristVal === 'Tourist Places Only' ? 1 : 0;
            baseQuery += ` AND g.is_tourist_place = ?`;
            countQuery += ` AND g.is_tourist_place = ?`;
            queryParams.push(isTourist);
            countParams.push(isTourist);
        }

        // Operational Status
        const opVal = is_operational !== undefined ? is_operational : operationalStatus;
        if (opVal !== undefined && opVal !== '') {
            const opParsed = parseValues(opVal);
            if (opParsed.includes('Operational') || opParsed.includes('1') || opParsed.includes(1)) {
                baseQuery += ` AND (g.is_operational = 1 OR g.is_operational IS NULL)`;
                countQuery += ` AND (g.is_operational = 1 OR g.is_operational IS NULL)`;
            } else if (opParsed.includes('Non-Operational') || opParsed.includes('0') || opParsed.includes(0)) {
                baseQuery += ` AND g.is_operational = 0`;
                countQuery += ` AND g.is_operational = 0`;
            }
        }

        // Public Access
        const paVal = is_public_access !== undefined ? is_public_access : publicAccess;
        if (paVal !== undefined && paVal !== '') {
            const paParsed = parseValues(paVal);
            if (paParsed.includes('Yes') || paParsed.includes('Public Access') || paParsed.includes('1') || paParsed.includes(1)) {
                baseQuery += ` AND (g.is_public_access = 1 OR g.is_public_access IS NULL)`;
                countQuery += ` AND (g.is_public_access = 1 OR g.is_public_access IS NULL)`;
            } else if (paParsed.includes('No') || paParsed.includes('Private Access') || paParsed.includes('0') || paParsed.includes(0)) {
                baseQuery += ` AND g.is_public_access = 0`;
                countQuery += ` AND g.is_public_access = 0`;
            }
        }

        // Parking
        const parkVal = has_parking !== undefined ? has_parking : parking;
        if (parkVal !== undefined && parkVal !== '') {
            const parkParsed = parseValues(parkVal);
            if (parkParsed.includes('Yes') || parkParsed.includes('Parking Available') || parkParsed.includes('1') || parkParsed.includes(1)) {
                baseQuery += ` AND g.has_parking = 1`;
                countQuery += ` AND g.has_parking = 1`;
            } else if (parkParsed.includes('No') || parkParsed.includes('No Parking') || parkParsed.includes('0') || parkParsed.includes(0)) {
                baseQuery += ` AND (g.has_parking = 0 OR g.has_parking IS NULL)`;
                countQuery += ` AND (g.has_parking = 0 OR g.has_parking IS NULL)`;
            }
        }

        // Wheelchair
        const wcVal = has_wheelchair !== undefined ? has_wheelchair : wheelchairAccess;
        if (wcVal !== undefined && wcVal !== '') {
            const wcParsed = parseValues(wcVal);
            if (wcParsed.includes('Yes') || wcParsed.includes('Wheelchair Accessible') || wcParsed.includes('1') || wcParsed.includes(1)) {
                baseQuery += ` AND g.has_wheelchair = 1`;
                countQuery += ` AND g.has_wheelchair = 1`;
            } else if (wcParsed.includes('No') || wcParsed.includes('Not Accessible') || wcParsed.includes('0') || wcParsed.includes(0)) {
                baseQuery += ` AND (g.has_wheelchair = 0 OR g.has_wheelchair IS NULL)`;
                countQuery += ` AND (g.has_wheelchair = 0 OR g.has_wheelchair IS NULL)`;
            }
        }

        // History
        const histVal = any_history !== undefined ? any_history : anyHistory;
        if (histVal !== undefined && histVal !== '') {
            const histParsed = parseValues(histVal);
            if (histParsed.includes('Yes') || histParsed.includes('Has History')) {
                baseQuery += ` AND g.any_history = 'Yes'`;
                countQuery += ` AND g.any_history = 'Yes'`;
            } else if (histParsed.includes('No') || histParsed.includes('No History')) {
                baseQuery += ` AND (g.any_history = 'No' OR g.any_history IS NULL)`;
                countQuery += ` AND (g.any_history = 'No' OR g.any_history IS NULL)`;
            }
        }

        // Search Query
        if (search) {
            const searchTerm = `%${search}%`;
            baseQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.sub_category LIKE ? OR g.landmark LIKE ? OR g.full_address LIKE ? OR g.description LIKE ? OR lb.name LIKE ? OR lbw.place_name LIKE ?)`;
            countQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.sub_category LIKE ? OR g.landmark LIKE ? OR g.full_address LIKE ? OR g.description LIKE ? OR lb.name LIKE ? OR lbw.place_name LIKE ?)`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        baseQuery += ` ORDER BY g.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(Number(limit), Number(offset));

        const [rows] = await db.query(baseQuery, queryParams);
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        // Compute full facet counts across published locations
        const [
            [typesRows],
            [categoryRows],
            [subCategoryRows],
            [localBodyRows],
            [wardRows],
            [touristRows],
            [opRows],
            [paRows],
            [parkRows],
            [wcRows],
            [histRows]
        ] = await Promise.all([
            db.query(`SELECT type, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY type`, [status]),
            db.query(`SELECT category, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY category`, [status]),
            db.query(`SELECT sub_category, COUNT(*) as count FROM geo_locations WHERE status = ? AND sub_category IS NOT NULL AND sub_category != '' GROUP BY sub_category`, [status]),
            db.query(`SELECT local_body_id, COUNT(*) as count FROM geo_locations WHERE status = ? AND local_body_id IS NOT NULL GROUP BY local_body_id`, [status]),
            db.query(`SELECT ward, local_body_id, COUNT(*) as count FROM geo_locations WHERE status = ? AND ward IS NOT NULL AND ward != '' GROUP BY ward, local_body_id`, [status]),
            db.query(`SELECT is_tourist_place, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY is_tourist_place`, [status]),
            db.query(`SELECT is_operational, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY is_operational`, [status]),
            db.query(`SELECT is_public_access, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY is_public_access`, [status]),
            db.query(`SELECT has_parking, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY has_parking`, [status]),
            db.query(`SELECT has_wheelchair, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY has_wheelchair`, [status]),
            db.query(`SELECT any_history, COUNT(*) as count FROM geo_locations WHERE status = ? GROUP BY any_history`, [status]),
        ]);

        const filterCounts = {
            types: {},
            categories: {},
            subCategories: {},
            localBodies: {},
            wards: {},
            touristPlace: { "Tourist Places Only": 0, "Non-Tourist Places": 0 },
            operationalStatus: { "Operational": 0, "Non-Operational": 0 },
            publicAccess: { "Yes": 0, "No": 0 },
            parking: { "Yes": 0, "No": 0 },
            wheelchairAccess: { "Yes": 0, "No": 0 },
            anyHistory: { "Has History": 0, "No History": 0 }
        };

        typesRows.forEach(r => { if (r.type) filterCounts.types[r.type] = r.count; });
        categoryRows.forEach(r => { if (r.category) filterCounts.categories[r.category] = r.count; });
        subCategoryRows.forEach(r => { if (r.sub_category) filterCounts.subCategories[r.sub_category] = r.count; });
        localBodyRows.forEach(r => { if (r.local_body_id != null) filterCounts.localBodies[String(r.local_body_id)] = r.count; });
        wardRows.forEach(r => {
            if (r.ward != null) {
                const wStr = String(r.ward).trim();
                const match = wStr.match(/\d+/);
                const cleanDigit = match ? match[0] : wStr;
                
                filterCounts.wards[cleanDigit] = (filterCounts.wards[cleanDigit] || 0) + r.count;
                filterCounts.wards[`Ward ${cleanDigit}`] = (filterCounts.wards[`Ward ${cleanDigit}`] || 0) + r.count;
                filterCounts.wards[wStr] = (filterCounts.wards[wStr] || 0) + r.count;
                if (r.local_body_id != null) {
                    filterCounts.wards[`${r.local_body_id}_${cleanDigit}`] = r.count;
                    filterCounts.wards[`${r.local_body_id}_${wStr}`] = r.count;
                }
            }
        });

        touristRows.forEach(r => {
            if (r.is_tourist_place === 1 || r.is_tourist_place === true) filterCounts.touristPlace["Tourist Places Only"] += r.count;
            else filterCounts.touristPlace["Non-Tourist Places"] += r.count;
        });

        opRows.forEach(r => {
            if (r.is_operational !== 0 && r.is_operational !== false) filterCounts.operationalStatus["Operational"] += r.count;
            else filterCounts.operationalStatus["Non-Operational"] += r.count;
        });

        paRows.forEach(r => {
            if (r.is_public_access !== 0 && r.is_public_access !== false) filterCounts.publicAccess["Yes"] += r.count;
            else filterCounts.publicAccess["No"] += r.count;
        });

        parkRows.forEach(r => {
            if (r.has_parking === 1 || r.has_parking === true) filterCounts.parking["Yes"] += r.count;
            else filterCounts.parking["No"] += r.count;
        });

        wcRows.forEach(r => {
            if (r.has_wheelchair === 1 || r.has_wheelchair === true) filterCounts.wheelchairAccess["Yes"] += r.count;
            else filterCounts.wheelchairAccess["No"] += r.count;
        });

        histRows.forEach(r => {
            if (r.any_history === 'Yes') filterCounts.anyHistory["Has History"] += r.count;
            else filterCounts.anyHistory["No History"] += r.count;
        });

        // Compute Tourist Spots count
        const touristCount = filterCounts.touristPlace?.["Tourist Places Only"] || (
            categoryRows.find(r => r.category === 'Tourist Spots' || r.category === 'Tourism')?.count || 0
        );

        // Global stats for cards
        const stats = {
            total,
            ...filterCounts.categories,
            "Tourist Spots": touristCount,
            "touristPlaces": touristCount,
            "Religious Sites": filterCounts.categories["Religious Sites"] || filterCounts.categories["Religious"] || 0,
            "Water Bodies": filterCounts.categories["Water Bodies"] || filterCounts.categories["Water Body"] || 0,
            "Educational": filterCounts.categories["Educational"] || filterCounts.categories["Education"] || 0,
            "Healthcare": filterCounts.categories["Healthcare"] || filterCounts.categories["Health"] || 0,
            "Government": filterCounts.categories["Government"] || filterCounts.categories["Govt"] || 0,
            "Public Places": filterCounts.categories["Public Places"] || filterCounts.categories["Public Place"] || 0,
        };

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            },
            stats,
            filterCounts
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

        const [touristRow] = await db.query(
            `SELECT COUNT(*) as touristCount FROM geo_locations WHERE status = 'published' AND (is_tourist_place = 1 OR category IN ('Tourist Spots', 'Tourism', 'Tourist Place'))`
        );

        const categoryCounts = {};
        categoryRows.forEach(row => {
            if (row.category) {
                categoryCounts[row.category] = row.count;
            }
        });

        const touristCount = touristRow[0]?.touristCount || 0;

        const stats = {
            total: totalRow[0]?.total || 0,
            touristCount,
            "Tourist Spots": touristCount,
            "touristPlaces": touristCount,
            "Religious Sites": categoryCounts["Religious Sites"] || categoryCounts["Religious"] || 0,
            "Water Bodies": categoryCounts["Water Bodies"] || categoryCounts["Water Body"] || 0,
            "Educational": categoryCounts["Educational"] || categoryCounts["Education"] || 0,
            "Healthcare": categoryCounts["Healthcare"] || categoryCounts["Health"] || 0,
            "Government": categoryCounts["Government"] || categoryCounts["Govt"] || 0,
            "Public Places": categoryCounts["Public Places"] || categoryCounts["Public Place"] || 0,
            wardsCount: wardRow[0]?.wardsCount || 0,
            addedThisWeek: weekRow[0]?.addedThisWeek || 0,
            mappedCount: mappedRow[0]?.mappedCount || 0,
            categoryCounts,
            ...categoryCounts
        };

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
            LEFT JOIN local_body_wards lbw ON lbw.local_body_id = g.local_body_id AND (CAST(lbw.ward_no AS CHAR) = CAST(g.ward AS CHAR) OR g.ward = CONCAT('Ward ', lbw.ward_no) OR (lbw.place_name IS NOT NULL AND g.ward = lbw.place_name))
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
        const { 
            page = 1, limit = 12, search, 
            type, types,
            category, categories,
            sub_category, sub_categories, subCategory, subCategories,
            local_body_id, local_bodies, localBody, localBodies,
            ward, wards 
        } = req.query;
        const offset = (page - 1) * limit;

        let baseQuery = `
            SELECT g.*, 
                (SELECT url FROM geo_location_images WHERE location_id = g.id ORDER BY display_order ASC LIMIT 1) AS cover_image,
                (SELECT COUNT(*) FROM geo_location_images WHERE location_id = g.id) AS image_count,
                (SELECT COUNT(*) FROM geo_location_attachments WHERE location_id = g.id) AS attachment_count,
                lb.name AS local_body_name,
                lbw.ward_no AS ward_number,
                lbw.place_name AS ward_place_name
            FROM geo_locations g
            INNER JOIN geo_location_bookmarks b ON g.id = b.location_id
            LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
            LEFT JOIN local_body_wards lbw ON lbw.local_body_id = g.local_body_id AND (CAST(lbw.ward_no AS CHAR) = CAST(g.ward AS CHAR) OR g.ward = CONCAT('Ward ', lbw.ward_no) OR (lbw.place_name IS NOT NULL AND g.ward = lbw.place_name))
            WHERE b.constituent_id = ? AND g.status = 'published'
        `;

        let countQuery = `
            SELECT COUNT(*) as total 
            FROM geo_locations g 
            INNER JOIN geo_location_bookmarks b ON g.id = b.location_id 
            LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
            LEFT JOIN local_body_wards lbw ON lbw.local_body_id = g.local_body_id AND (CAST(lbw.ward_no AS CHAR) = CAST(g.ward AS CHAR) OR g.ward = CONCAT('Ward ', lbw.ward_no) OR (lbw.place_name IS NOT NULL AND g.ward = lbw.place_name))
            WHERE b.constituent_id = ? AND g.status = 'published'
        `;

        const queryParams = [constituentId];
        const countParams = [constituentId];

        // Types
        const typeVals = parseValues(types || type).filter(v => v !== 'All');
        if (typeVals.length > 0) {
            const placeholders = typeVals.map(() => '?').join(',');
            baseQuery += ` AND g.type IN (${placeholders})`;
            countQuery += ` AND g.type IN (${placeholders})`;
            queryParams.push(...typeVals);
            countParams.push(...typeVals);
        }

        // Categories
        const catVals = parseValues(categories || category).filter(v => v !== 'All');
        if (catVals.length > 0) {
            const placeholders = catVals.map(() => '?').join(',');
            baseQuery += ` AND g.category IN (${placeholders})`;
            countQuery += ` AND g.category IN (${placeholders})`;
            queryParams.push(...catVals);
            countParams.push(...catVals);
        }

        // Sub Categories
        const subCatVals = parseValues(subCategories || subCategory || sub_categories || sub_category).filter(v => v !== 'All');
        if (subCatVals.length > 0) {
            const placeholders = subCatVals.map(() => '?').join(',');
            baseQuery += ` AND g.sub_category IN (${placeholders})`;
            countQuery += ` AND g.sub_category IN (${placeholders})`;
            queryParams.push(...subCatVals);
            countParams.push(...subCatVals);
        }

        // Local Bodies
        const lbVals = parseValues(localBodies || localBody || local_bodies || local_body_id).filter(v => v !== 'All');
        if (lbVals.length > 0) {
            const isAllNumeric = lbVals.every(v => !isNaN(Number(v)));
            const placeholders = lbVals.map(() => '?').join(',');
            if (isAllNumeric) {
                baseQuery += ` AND g.local_body_id IN (${placeholders})`;
                countQuery += ` AND g.local_body_id IN (${placeholders})`;
                queryParams.push(...lbVals.map(Number));
                countParams.push(...lbVals.map(Number));
            } else {
                baseQuery += ` AND lb.name IN (${placeholders})`;
                countQuery += ` AND lb.name IN (${placeholders})`;
                queryParams.push(...lbVals);
                countParams.push(...lbVals);
            }
        }

        // Wards (handles "Ward 5", "5", "39_5", place names, etc.)
        const rawWardVals = parseValues(wards || ward).filter(v => v !== 'All');
        if (rawWardVals.length > 0) {
            const wardClauses = [];
            for (const rawW of rawWardVals) {
                const str = String(rawW).trim();
                if (str.includes('_')) {
                    const [lbId, wNo] = str.split('_');
                    const match = wNo.match(/\d+/);
                    const cleanD = match ? match[0] : wNo;
                    wardClauses.push(`(g.local_body_id = ? AND (g.ward = ? OR g.ward = ? OR g.ward LIKE ? OR lbw.ward_no = ?))`);
                    queryParams.push(Number(lbId), cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD);
                    countParams.push(Number(lbId), cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD);
                } else {
                    const match = str.match(/\d+/);
                    const cleanD = match ? match[0] : str;
                    wardClauses.push(`(g.ward = ? OR g.ward = ? OR g.ward LIKE ? OR lbw.ward_no = ? OR (lbw.place_name IS NOT NULL AND lbw.place_name LIKE ?))`);
                    queryParams.push(cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD, `%${str}%`);
                    countParams.push(cleanD, `Ward ${cleanD}`, `%${cleanD}%`, cleanD, `%${str}%`);
                }
            }
            if (wardClauses.length > 0) {
                baseQuery += ` AND (${wardClauses.join(' OR ')})`;
                countQuery += ` AND (${wardClauses.join(' OR ')})`;
            }
        }

        // Tourist Place
        const touristVal = req.query.is_tourist_place !== undefined ? req.query.is_tourist_place : req.query.touristPlace;
        if (touristVal !== undefined && touristVal !== '') {
            const isTourist = touristVal === 'true' || touristVal === '1' || touristVal === 1 || touristVal === 'Tourist Places Only' ? 1 : 0;
            baseQuery += ` AND g.is_tourist_place = ?`;
            countQuery += ` AND g.is_tourist_place = ?`;
            queryParams.push(isTourist);
            countParams.push(isTourist);
        }

        // Operational Status
        const opVal = req.query.is_operational !== undefined ? req.query.is_operational : req.query.operationalStatus;
        if (opVal !== undefined && opVal !== '') {
            const opParsed = parseValues(opVal);
            if (opParsed.includes('Operational') || opParsed.includes('1') || opParsed.includes(1)) {
                baseQuery += ` AND (g.is_operational = 1 OR g.is_operational IS NULL)`;
                countQuery += ` AND (g.is_operational = 1 OR g.is_operational IS NULL)`;
            } else if (opParsed.includes('Non-Operational') || opParsed.includes('0') || opParsed.includes(0)) {
                baseQuery += ` AND g.is_operational = 0`;
                countQuery += ` AND g.is_operational = 0`;
            }
        }

        // Public Access
        const paVal = req.query.is_public_access !== undefined ? req.query.is_public_access : req.query.publicAccess;
        if (paVal !== undefined && paVal !== '') {
            const paParsed = parseValues(paVal);
            if (paParsed.includes('Yes') || paParsed.includes('Public Access') || paParsed.includes('1') || paParsed.includes(1)) {
                baseQuery += ` AND (g.is_public_access = 1 OR g.is_public_access IS NULL)`;
                countQuery += ` AND (g.is_public_access = 1 OR g.is_public_access IS NULL)`;
            } else if (paParsed.includes('No') || paParsed.includes('Private Access') || paParsed.includes('0') || paParsed.includes(0)) {
                baseQuery += ` AND g.is_public_access = 0`;
                countQuery += ` AND g.is_public_access = 0`;
            }
        }

        // Parking
        const parkVal = req.query.has_parking !== undefined ? req.query.has_parking : req.query.parking;
        if (parkVal !== undefined && parkVal !== '') {
            const parkParsed = parseValues(parkVal);
            if (parkParsed.includes('Yes') || parkParsed.includes('Parking Available') || parkParsed.includes('1') || parkParsed.includes(1)) {
                baseQuery += ` AND g.has_parking = 1`;
                countQuery += ` AND g.has_parking = 1`;
            } else if (parkParsed.includes('No') || parkParsed.includes('No Parking') || parkParsed.includes('0') || parkParsed.includes(0)) {
                baseQuery += ` AND (g.has_parking = 0 OR g.has_parking IS NULL)`;
                countQuery += ` AND (g.has_parking = 0 OR g.has_parking IS NULL)`;
            }
        }

        // Wheelchair
        const wcVal = req.query.has_wheelchair !== undefined ? req.query.has_wheelchair : req.query.wheelchairAccess;
        if (wcVal !== undefined && wcVal !== '') {
            const wcParsed = parseValues(wcVal);
            if (wcParsed.includes('Yes') || wcParsed.includes('Wheelchair Accessible') || wcParsed.includes('1') || wcParsed.includes(1)) {
                baseQuery += ` AND g.has_wheelchair = 1`;
                countQuery += ` AND g.has_wheelchair = 1`;
            } else if (wcParsed.includes('No') || wcParsed.includes('Not Accessible') || wcParsed.includes('0') || wcParsed.includes(0)) {
                baseQuery += ` AND (g.has_wheelchair = 0 OR g.has_wheelchair IS NULL)`;
                countQuery += ` AND (g.has_wheelchair = 0 OR g.has_wheelchair IS NULL)`;
            }
        }

        // History
        const histVal = req.query.any_history !== undefined ? req.query.any_history : req.query.anyHistory;
        if (histVal !== undefined && histVal !== '') {
            const histParsed = parseValues(histVal);
            if (histParsed.includes('Yes') || histParsed.includes('Has History')) {
                baseQuery += ` AND g.any_history = 'Yes'`;
                countQuery += ` AND g.any_history = 'Yes'`;
            } else if (histParsed.includes('No') || histParsed.includes('No History')) {
                baseQuery += ` AND (g.any_history = 'No' OR g.any_history IS NULL)`;
                countQuery += ` AND (g.any_history = 'No' OR g.any_history IS NULL)`;
            }
        }

        // Search
        if (search) {
            const searchTerm = `%${search}%`;
            baseQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.sub_category LIKE ? OR g.landmark LIKE ? OR lb.name LIKE ? OR lbw.place_name LIKE ?)`;
            countQuery += ` AND (g.name LIKE ? OR g.category LIKE ? OR g.sub_category LIKE ? OR g.landmark LIKE ? OR lb.name LIKE ? OR lbw.place_name LIKE ?)`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        baseQuery += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(Number(limit), Number(offset));

        const [rows] = await db.query(baseQuery, queryParams);
        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        // Compute full facet counts across bookmarks
        const [
            [typesRows],
            [categoryRows],
            [subCategoryRows],
            [localBodyRows],
            [wardRows],
            [touristRows],
            [opRows],
            [paRows],
            [parkRows],
            [wcRows],
            [histRows]
        ] = await Promise.all([
            db.query(`SELECT g.type, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.type`, [constituentId]),
            db.query(`SELECT g.category, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.category`, [constituentId]),
            db.query(`SELECT g.sub_category, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' AND g.sub_category IS NOT NULL AND g.sub_category != '' GROUP BY g.sub_category`, [constituentId]),
            db.query(`SELECT g.local_body_id, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' AND g.local_body_id IS NOT NULL GROUP BY g.local_body_id`, [constituentId]),
            db.query(`SELECT g.ward, g.local_body_id, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' AND g.ward IS NOT NULL AND g.ward != '' GROUP BY g.ward, g.local_body_id`, [constituentId]),
            db.query(`SELECT g.is_tourist_place, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.is_tourist_place`, [constituentId]),
            db.query(`SELECT g.is_operational, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.is_operational`, [constituentId]),
            db.query(`SELECT g.is_public_access, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.is_public_access`, [constituentId]),
            db.query(`SELECT g.has_parking, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.has_parking`, [constituentId]),
            db.query(`SELECT g.has_wheelchair, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.has_wheelchair`, [constituentId]),
            db.query(`SELECT g.any_history, COUNT(*) as count FROM geo_locations g INNER JOIN geo_location_bookmarks b ON g.id = b.location_id WHERE b.constituent_id = ? AND g.status = 'published' GROUP BY g.any_history`, [constituentId]),
        ]);

        const filterCounts = {
            types: {},
            categories: {},
            subCategories: {},
            localBodies: {},
            wards: {},
            touristPlace: { "Tourist Places Only": 0, "Non-Tourist Places": 0 },
            operationalStatus: { "Operational": 0, "Non-Operational": 0 },
            publicAccess: { "Yes": 0, "No": 0 },
            parking: { "Yes": 0, "No": 0 },
            wheelchairAccess: { "Yes": 0, "No": 0 },
            anyHistory: { "Has History": 0, "No History": 0 }
        };

        typesRows.forEach(r => { if (r.type) filterCounts.types[r.type] = r.count; });
        categoryRows.forEach(r => { if (r.category) filterCounts.categories[r.category] = r.count; });
        subCategoryRows.forEach(r => { if (r.sub_category) filterCounts.subCategories[r.sub_category] = r.count; });
        localBodyRows.forEach(r => { if (r.local_body_id != null) filterCounts.localBodies[String(r.local_body_id)] = r.count; });
        wardRows.forEach(r => {
            if (r.ward != null) {
                const wStr = String(r.ward).trim();
                const match = wStr.match(/\d+/);
                const cleanDigit = match ? match[0] : wStr;
                
                filterCounts.wards[cleanDigit] = (filterCounts.wards[cleanDigit] || 0) + r.count;
                filterCounts.wards[`Ward ${cleanDigit}`] = (filterCounts.wards[`Ward ${cleanDigit}`] || 0) + r.count;
                filterCounts.wards[wStr] = (filterCounts.wards[wStr] || 0) + r.count;
                if (r.local_body_id != null) {
                    filterCounts.wards[`${r.local_body_id}_${cleanDigit}`] = r.count;
                    filterCounts.wards[`${r.local_body_id}_${wStr}`] = r.count;
                }
            }
        });

        touristRows.forEach(r => {
            if (r.is_tourist_place === 1 || r.is_tourist_place === true) filterCounts.touristPlace["Tourist Places Only"] += r.count;
            else filterCounts.touristPlace["Non-Tourist Places"] += r.count;
        });

        opRows.forEach(r => {
            if (r.is_operational !== 0 && r.is_operational !== false) filterCounts.operationalStatus["Operational"] += r.count;
            else filterCounts.operationalStatus["Non-Operational"] += r.count;
        });

        paRows.forEach(r => {
            if (r.is_public_access !== 0 && r.is_public_access !== false) filterCounts.publicAccess["Yes"] += r.count;
            else filterCounts.publicAccess["No"] += r.count;
        });

        parkRows.forEach(r => {
            if (r.has_parking === 1 || r.has_parking === true) filterCounts.parking["Yes"] += r.count;
            else filterCounts.parking["No"] += r.count;
        });

        wcRows.forEach(r => {
            if (r.has_wheelchair === 1 || r.has_wheelchair === true) filterCounts.wheelchairAccess["Yes"] += r.count;
            else filterCounts.wheelchairAccess["No"] += r.count;
        });

        histRows.forEach(r => {
            if (r.any_history === 'Yes') filterCounts.anyHistory["Has History"] += r.count;
            else filterCounts.anyHistory["No History"] += r.count;
        });

        const stats = { total, ...filterCounts.categories };

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            },
            stats,
            filterCounts
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
            is_operational, is_public_access, has_parking, has_wheelchair, is_tourist_place, status
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
                is_operational, is_public_access, has_parking, has_wheelchair, is_tourist_place, status, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                type, name, category || null, sub_category || null, established_year || null, phone || null,
                any_history || 'No', history_details || null, local_body_id || null, ward || null, landmark || null, full_address || null,
                coordinates || null, digipin || null, contact_person || null, contact_role || null, contact_number || null,
                alt_number || null, operating_hours || null, website || null, facilities || null, description || null,
                is_operational !== undefined ? is_operational : 1, 
                is_public_access !== undefined ? is_public_access : 1, 
                has_parking !== undefined ? has_parking : 0, 
                has_wheelchair !== undefined ? has_wheelchair : 0,
                is_tourist_place !== undefined ? is_tourist_place : 0,
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
            is_operational, is_public_access, has_parking, has_wheelchair, is_tourist_place, status
        } = req.body;

        const adminId = req.admin ? req.admin.id : null;

        const [result] = await db.query(
            `UPDATE geo_locations SET 
                type = ?, name = ?, category = ?, sub_category = ?, established_year = ?, phone = ?,
                any_history = ?, history_details = ?, local_body_id = ?, ward = ?, landmark = ?, full_address = ?,
                coordinates = ?, digipin = ?, contact_person = ?, contact_role = ?, contact_number = ?,
                alt_number = ?, operating_hours = ?, website = ?, facilities = ?, description = ?,
                is_operational = ?, is_public_access = ?, has_parking = ?, has_wheelchair = ?, is_tourist_place = ?, status = ?, updated_by = ?
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
                is_tourist_place !== undefined ? is_tourist_place : 0,
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

