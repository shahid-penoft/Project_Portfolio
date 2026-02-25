import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

const deleteFile = (url) => {
    if (!url || !url.startsWith('/uploads/')) return;
    const filePath = path.join(uploadDir, path.basename(url));
    fs.unlink(filePath, () => { });
};

// ─────────────────────────────────────────────────────────────
//  POST /api/ente-nadu-testimonials/upload  (Auth)
// ─────────────────────────────────────────────────────────────
export const uploadTestimonialMedia = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: `/uploads/${req.file.filename}` }, 'File uploaded.');
    } catch (err) {
        console.error('[uploadTestimonialMedia]', err);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/ente-nadu-testimonials
//  Public — paginated, optional ?type=text|video, optional ?search
// ─────────────────────────────────────────────────────────────
export const getTestimonials = async (req, res) => {
    const { search, type } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    try {
        let where = "WHERE 1=1";
        const params = [];

        if (type === 'text' || type === 'video') {
            where += ' AND type = ?';
            params.push(type);
        }
        if (search) {
            const like = `%${search}%`;
            where += ' AND (author_name LIKE ? OR quote LIKE ? OR caption LIKE ?)';
            params.push(like, like, like);
        }

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM ente_nadu_testimonials ${where}`, params
        );

        const [rows] = await pool.query(
            `SELECT * FROM ente_nadu_testimonials ${where} ORDER BY order_index ASC, id DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error('[getTestimonials]', err);
        return errorResponse(res, 'Failed to fetch testimonials.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/ente-nadu-testimonials/:id  (Public)
// ─────────────────────────────────────────────────────────────
export const getTestimonialById = async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM ente_nadu_testimonials WHERE id = ?', [req.params.id]);
        if (!row) return errorResponse(res, 'Testimonial not found.', 404);
        return successResponse(res, { data: row });
    } catch (err) {
        console.error('[getTestimonialById]', err);
        return errorResponse(res, 'Failed to fetch testimonial.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/ente-nadu-testimonials  (Auth)
// ─────────────────────────────────────────────────────────────
export const createTestimonial = async (req, res) => {
    const {
        type, author_name, house_name, quote,
        avatar_url, video_url, thumbnail_url, caption, order_index
    } = req.body;

    if (!type || !['text', 'video'].includes(type))
        return errorResponse(res, 'type must be "text" or "video".', 400);
    if (type === 'text' && !author_name?.trim())
        return errorResponse(res, 'author_name is required for text testimonials.', 400);
    if (type === 'video' && !video_url?.trim())
        return errorResponse(res, 'video_url is required for video testimonials.', 400);

    try {
        let idx = order_index;
        if (idx === undefined || idx === null) {
            const [[{ maxIdx }]] = await pool.query(
                "SELECT COALESCE(MAX(order_index), -1) AS maxIdx FROM ente_nadu_testimonials WHERE type = ?", [type]
            );
            idx = maxIdx + 1;
        }

        const [result] = await pool.query(
            `INSERT INTO ente_nadu_testimonials
             (type, author_name, house_name, quote, avatar_url, video_url, thumbnail_url, caption, order_index)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                type,
                author_name?.trim() || null,
                house_name?.trim() || null,
                quote?.trim() || null,
                avatar_url || null,
                video_url?.trim() || null,
                thumbnail_url || null,
                caption?.trim() || null,
                idx,
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM ente_nadu_testimonials WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: row }, 'Testimonial created successfully.', 201);
    } catch (err) {
        console.error('[createTestimonial]', err);
        return errorResponse(res, 'Failed to create testimonial.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/ente-nadu-testimonials/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const updateTestimonial = async (req, res) => {
    const { id } = req.params;
    const {
        author_name, house_name, quote,
        avatar_url, video_url, thumbnail_url, caption, order_index
    } = req.body;

    try {
        const [[old]] = await pool.query('SELECT * FROM ente_nadu_testimonials WHERE id = ?', [id]);
        if (!old) return errorResponse(res, 'Testimonial not found.', 404);

        // Clean orphaned uploads
        if (old.avatar_url && old.avatar_url !== avatar_url) deleteFile(old.avatar_url);
        if (old.thumbnail_url && old.thumbnail_url !== thumbnail_url) deleteFile(old.thumbnail_url);

        await pool.query(
            `UPDATE ente_nadu_testimonials
             SET author_name = ?, house_name = ?, quote = ?,
                 avatar_url  = ?, video_url  = ?, thumbnail_url = ?,
                 caption     = ?, order_index = ?
             WHERE id = ?`,
            [
                author_name?.trim() || null,
                house_name?.trim() || null,
                quote?.trim() || null,
                avatar_url || null,
                video_url?.trim() || null,
                thumbnail_url || null,
                caption?.trim() || null,
                order_index ?? old.order_index,
                id,
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM ente_nadu_testimonials WHERE id = ?', [id]);
        return successResponse(res, { data: row }, 'Testimonial updated successfully.');
    } catch (err) {
        console.error('[updateTestimonial]', err);
        return errorResponse(res, 'Failed to update testimonial.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/ente-nadu-testimonials/:id  (Auth)
// ─────────────────────────────────────────────────────────────
export const deleteTestimonial = async (req, res) => {
    const { id } = req.params;
    try {
        const [[row]] = await pool.query('SELECT * FROM ente_nadu_testimonials WHERE id = ?', [id]);
        if (!row) return errorResponse(res, 'Testimonial not found.', 404);
        if (row.avatar_url) deleteFile(row.avatar_url);
        if (row.thumbnail_url) deleteFile(row.thumbnail_url);
        await pool.query('DELETE FROM ente_nadu_testimonials WHERE id = ?', [id]);
        return successResponse(res, {}, 'Testimonial deleted successfully.');
    } catch (err) {
        console.error('[deleteTestimonial]', err);
        return errorResponse(res, 'Failed to delete testimonial.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/ente-nadu-testimonials/:id/promote  (Auth)
// ─────────────────────────────────────────────────────────────
export const promoteTestimonial = async (req, res) => {
    const { id } = req.params;
    try {
        const [[row]] = await pool.query('SELECT type FROM ente_nadu_testimonials WHERE id = ?', [id]);
        if (!row) return errorResponse(res, 'Testimonial not found.', 404);
        await pool.query(
            'UPDATE ente_nadu_testimonials SET order_index = order_index + 1 WHERE type = ?', [row.type]
        );
        await pool.query('UPDATE ente_nadu_testimonials SET order_index = 0 WHERE id = ?', [id]);
        return successResponse(res, {}, 'Testimonial promoted to top.');
    } catch (err) {
        console.error('[promoteTestimonial]', err);
        return errorResponse(res, 'Failed to promote testimonial.');
    }
};
