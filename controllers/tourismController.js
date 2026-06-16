import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadImage } from '../configs/multerS3.js';

const slugify = (text) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const formatAttraction = (row) => ({
    ...row,
    id: row.id,
    daysOpen: typeof row.days_open === 'string'
        ? JSON.parse(row.days_open || '[]')
        : row.days_open || [],
    mapUrl: row.map_url,
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    publishedBy: { 
        name: row.published_by || 'MLA Office', 
        initials: (row.published_by || 'MLA Office').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) 
    },
    updatedAt: row.updated_at,
    timings: row.opening_time && row.closing_time
        ? `${row.opening_time} - ${row.closing_time}`
        : null,
});

// GET /api/tourism/all
export const getAttractions = async (req, res) => {
    try {
        const { search, category, location } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (category && category !== 'all') {
            where += ' AND category = ?';
            params.push(category);
        }

        if (location && location !== 'all') {
            where += ' AND location = ?';
            params.push(location);
        }

        if (search) {
            where += ' AND (title LIKE ? OR description LIKE ? OR location LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM tourism_attractions ${where}`, params);

        const [rows] = await pool.query(
            `SELECT * FROM tourism_attractions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const formattedRows = rows.map(formatAttraction);

        // Fetch categories and locations for filters
        const [categoriesRows] = await pool.query('SELECT DISTINCT category FROM tourism_attractions WHERE category IS NOT NULL');
        const [locationsRows] = await pool.query('SELECT DISTINCT location FROM tourism_attractions WHERE location IS NOT NULL');

        const categories = categoriesRows.map(r => r.category).filter(Boolean);
        const locationsList = locationsRows.map(r => r.location).filter(Boolean);

        return successResponse(res, {
            data: formattedRows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            categories,
            locations: locationsList
        }, 'Attractions fetched successfully.');
    } catch (err) {
        console.error('[getAttractions]', err);
        return errorResponse(res, 'Failed to fetch attractions.');
    }
};

// GET /api/tourism/:slug
export const getAttractionBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const [[attraction]] = await pool.query('SELECT * FROM tourism_attractions WHERE slug = ?', [slug]);

        if (!attraction) return errorResponse(res, 'Attraction not found.', 404);

        return successResponse(res, { data: formatAttraction(attraction) }, 'Attraction fetched successfully.');
    } catch (err) {
        console.error('[getAttractionBySlug]', err);
        return errorResponse(res, 'Failed to fetch attraction.');
    }
};

// GET /api/tourism/admin/:id
export const getAttractionById = async (req, res) => {
    try {
        const { id } = req.params;
        const [[attraction]] = await pool.query('SELECT * FROM tourism_attractions WHERE id = ?', [id]);

        if (!attraction) return errorResponse(res, 'Attraction not found.', 404);

        return successResponse(res, { data: formatAttraction(attraction) }, 'Attraction fetched successfully.');
    } catch (err) {
        console.error('[getAttractionById]', err);
        return errorResponse(res, 'Failed to fetch attraction.');
    }
};

// POST /api/tourism
export const createAttraction = async (req, res) => {
    try {
        const { title, description, image, location, category, mapUrl, openingTime, closingTime, daysOpen } = req.body;

        if (!title || !location) {
            return errorResponse(res, 'Title and Location are required.', 400);
        }

        let baseSlug = slugify(title);
        let slug = baseSlug;
        let count = 1;
        while (true) {
            const [[existing]] = await pool.query('SELECT id FROM tourism_attractions WHERE slug = ?', [slug]);
            if (!existing) break;
            slug = `${baseSlug}-${count++}`;
        }

        const [result] = await pool.query(
            `INSERT INTO tourism_attractions 
             (slug, title, description, image, location, category, map_url, opening_time, closing_time, days_open)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                slug, title, description || null, image || null, location, category || 'Other',
                mapUrl || null, openingTime || null, closingTime || null,
                JSON.stringify(daysOpen || [])
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM tourism_attractions WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: formatAttraction(row) }, 'Attraction created successfully.', 201);
    } catch (err) {
        console.error('[createAttraction]', err);
        return errorResponse(res, 'Failed to create attraction.');
    }
};

// PUT /api/tourism/:id
export const updateAttraction = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, image, location, category, mapUrl, openingTime, closingTime, daysOpen } = req.body;

        if (!title || !location) {
            return errorResponse(res, 'Title and Location are required.', 400);
        }

        const [[existing]] = await pool.query('SELECT * FROM tourism_attractions WHERE id = ?', [id]);
        if (!existing) return errorResponse(res, 'Attraction not found.', 404);

        let slug = existing.slug;
        if (existing.title !== title) {
            let baseSlug = slugify(title);
            slug = baseSlug;
            let count = 1;
            while (true) {
                const [[duplicate]] = await pool.query('SELECT id FROM tourism_attractions WHERE slug = ? AND id != ?', [slug, id]);
                if (!duplicate) break;
                slug = `${baseSlug}-${count++}`;
            }
        }

        await pool.query(
            `UPDATE tourism_attractions 
             SET slug = ?, title = ?, description = ?, image = ?, location = ?, category = ?, 
                 map_url = ?, opening_time = ?, closing_time = ?, days_open = ?
             WHERE id = ?`,
            [
                slug, title, description || null, image || null, location, category || 'Other',
                mapUrl || null, openingTime || null, closingTime || null,
                JSON.stringify(daysOpen || []), id
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM tourism_attractions WHERE id = ?', [id]);
        return successResponse(res, { data: formatAttraction(row) }, 'Attraction updated successfully.');
    } catch (err) {
        console.error('[updateAttraction]', err);
        return errorResponse(res, 'Failed to update attraction.');
    }
};

// DELETE /api/tourism/:id
export const deleteAttraction = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM tourism_attractions WHERE id = ?', [id]);
        if (!result.affectedRows) return errorResponse(res, 'Attraction not found.', 404);
        return successResponse(res, {}, 'Attraction deleted successfully.');
    } catch (err) {
        console.error('[deleteAttraction]', err);
        return errorResponse(res, 'Failed to delete attraction.');
    }
};

// POST /api/tourism/upload-image
export const uploadTourismImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No image file provided.', 400);

        const imageUrl = req.file.location || req.file.path;
        return successResponse(res, { url: imageUrl }, 'Image uploaded successfully.', 201);
    } catch (err) {
        console.error('[uploadTourismImage]', err);
        return errorResponse(res, err.message || 'Image upload failed.', 500);
    }
};

// POST /api/tourism/suggest
export const submitSuggestion = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);

        let bodyData = req.body;
        // Check if data is nested under 'data' due to formData differences or sent directly
        const title = bodyData.title;
        const description = bodyData.description;
        const location = bodyData.location;
        const mapUrl = bodyData.mapUrl;
        const openingTime = bodyData.openingTime;
        const closingTime = bodyData.closingTime;
        const daysOpen = bodyData.daysOpen ? (typeof bodyData.daysOpen === 'string' ? JSON.parse(bodyData.daysOpen) : bodyData.daysOpen) : [];
        const submitterName = req.constituent?.name || bodyData.submitterName || null;

        if (!title || !description || !location) {
            return errorResponse(res, 'Title, description, and location are required.', 400);
        }

        const imageUrl = req.file ? (req.file.location || req.file.path) : null;

        await pool.query(
            `INSERT INTO tourism_suggestions 
             (title, description, location, map_url, opening_time, closing_time, days_open, image_url, submitter_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title, description, location, mapUrl || null, openingTime || null, closingTime || null,
                JSON.stringify(daysOpen), imageUrl, submitterName
            ]
        );

        return successResponse(res, {}, 'Suggestion submitted successfully.', 201);
    } catch (err) {
        console.error('[submitSuggestion]', err);
        return errorResponse(res, err.message || 'Failed to submit suggestion.', 500);
    }
};
