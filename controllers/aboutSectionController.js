import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';

const parseJson = (val, fallback = []) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

// GET /api/about-section (public)
export const getAboutSection = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM about_section WHERE id = 1');
        if (!rows.length) return successResponse(res, { data: null }, 'No about section found.');
        const row = rows[0];
        row.buttons = parseJson(row.buttons, []);
        row.roles = parseJson(row.roles, []);
        return successResponse(res, { data: row }, 'About section fetched.');
    } catch (err) {
        console.error('[getAboutSection]', err);
        return errorResponse(res, 'Server error fetching about section.');
    }
};

// PUT /api/about-section (protected)
export const updateAboutSection = async (req, res) => {
    try {
        const { title, description, quote, image_url, buttons, roles } = req.body;

        const buttonsArr = Array.isArray(buttons) ? buttons.slice(0, 2) : [];
        const rolesArr = Array.isArray(roles) ? roles.slice(0, 4) : [];

        await pool.query(
            `UPDATE about_section SET 
             title = ?, description = ?, quote = ?, image_url = ?, buttons = ?, roles = ?
             WHERE id = 1`,
            [
                title || null,
                description || null,
                quote || null,
                image_url || null,
                JSON.stringify(buttonsArr),
                JSON.stringify(rolesArr),
            ]
        );

        const [rows] = await pool.query('SELECT * FROM about_section WHERE id = 1');
        const row = rows[0];
        row.buttons = parseJson(row.buttons, []);
        row.roles = parseJson(row.roles, []);
        return successResponse(res, { data: row }, 'About section updated.');
    } catch (err) {
        console.error('[updateAboutSection]', err);
        return errorResponse(res, 'Server error updating about section.');
    }
};

// POST /api/about-section/upload (protected)
export const uploadAboutImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        const fileUrl = req.file.location || `/uploads/${req.file.filename}`;
        return successResponse(res, { url: fileUrl }, 'About image uploaded.');
    } catch (err) {
        console.error('[uploadAboutImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Server error uploading image.');
    }
};
