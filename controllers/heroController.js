import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multer.js';

// GET /api/hero (public)
export const getHero = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM hero_sections WHERE id = 1');
        if (!rows.length) return errorResponse(res, 'Hero section not found.', 404);
        return successResponse(res, { data: rows[0] }, 'Hero section fetched.');
    } catch (err) {
        console.error('[getHero]', err);
        return errorResponse(res, 'Server error fetching hero section.');
    }
};

// PUT /api/hero (protected)
export const updateHero = async (req, res) => {
    try {
        const { welcome_text, title, subtitle, description, image_url } = req.body;

        await db.query(
            `UPDATE hero_sections SET 
             welcome_text = ?, title = ?, subtitle = ?, description = ?, image_url = ? 
             WHERE id = 1`,
            [welcome_text, title, subtitle, description, image_url]
        );

        const [rows] = await db.query('SELECT * FROM hero_sections WHERE id = 1');
        return successResponse(res, { data: rows[0] }, 'Hero section updated.');
    } catch (err) {
        console.error('[updateHero]', err);
        return errorResponse(res, 'Server error updating hero section.');
    }
};

// POST /api/hero/upload (protected)
export const uploadHeroImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);

        const fileUrl = `/uploads/${req.file.filename}`;
        return successResponse(res, { url: fileUrl }, 'Hero image uploaded.');
    } catch (err) {
        console.error('[uploadHeroImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Server error uploading image.');
    }
};
