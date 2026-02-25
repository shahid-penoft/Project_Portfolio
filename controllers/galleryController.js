import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);

const getFileType = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    if (IMAGE_EXTS.has(ext)) return 'image';
    if (VIDEO_EXTS.has(ext)) return 'video';
    return 'other';
};

// ─────────────────────────────────────────────────────────────
//  GET /api/gallery/images
//  Public — all event photos, grouped by event_type, searchable
// ─────────────────────────────────────────────────────────────
export const getGalleryImages = async (req, res) => {
    try {
        const { search, event_type_id } = req.query;

        let where = `WHERE em.media_type = 'photo'`;
        const params = [];

        if (event_type_id) { where += ' AND e.event_type_id = ?'; params.push(event_type_id); }
        if (search) { where += ' AND (e.event_name LIKE ? OR em.caption LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        const [rows] = await db.query(
            `SELECT
         em.id, em.file_url, em.caption, em.created_at,
         e.id         AS event_id,
         e.event_name,
         e.event_date,
         et.id        AS event_type_id,
         et.type_name AS event_type
       FROM event_media em
       JOIN events      e  ON  e.id = em.event_id
       LEFT JOIN event_types et ON et.id  = e.event_type_id
       ${where}
       ORDER BY et.type_name ASC, e.event_date DESC`,
            params
        );

        // Group by event type
        const grouped = {};
        for (const row of rows) {
            const key = row.event_type || 'Uncategorized';
            if (!grouped[key]) grouped[key] = { event_type_id: row.event_type_id, event_type: key, images: [] };
            grouped[key].images.push({
                id: row.id, file_url: row.file_url, caption: row.caption,
                event_id: row.event_id, event_name: row.event_name, event_date: row.event_date,
                created_at: row.created_at,
            });
        }

        return successResponse(res, {
            data: Object.values(grouped),
            total: rows.length,
        }, 'Gallery images fetched successfully.');
    } catch (err) {
        console.error('[getGalleryImages]', err);
        return errorResponse(res, 'Server error fetching gallery images.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/gallery/videos
//  Public — all event videos, grouped by event_type, searchable
// ─────────────────────────────────────────────────────────────
export const getGalleryVideos = async (req, res) => {
    try {
        const { search, event_type_id } = req.query;

        let where = `WHERE em.media_type = 'video'`;
        const params = [];

        if (event_type_id) { where += ' AND e.event_type_id = ?'; params.push(event_type_id); }
        if (search) { where += ' AND (e.event_name LIKE ? OR em.caption LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

        const [rows] = await db.query(
            `SELECT
         em.id, em.file_url, em.caption, em.created_at,
         e.id         AS event_id,
         e.event_name,
         e.event_date,
         et.id        AS event_type_id,
         et.type_name AS event_type
       FROM event_media em
       JOIN events      e  ON  e.id = em.event_id
       LEFT JOIN event_types et ON et.id  = e.event_type_id
       ${where}
       ORDER BY et.type_name ASC, e.event_date DESC`,
            params
        );

        // Group by event type
        const grouped = {};
        for (const row of rows) {
            const key = row.event_type || 'Uncategorized';
            if (!grouped[key]) grouped[key] = { event_type_id: row.event_type_id, event_type: key, videos: [] };
            grouped[key].videos.push({
                id: row.id, file_url: row.file_url, caption: row.caption,
                event_id: row.event_id, event_name: row.event_name, event_date: row.event_date,
                created_at: row.created_at,
            });
        }

        return successResponse(res, {
            data: Object.values(grouped),
            total: rows.length,
        }, 'Gallery videos fetched successfully.');
    } catch (err) {
        console.error('[getGalleryVideos]', err);
        return errorResponse(res, 'Server error fetching gallery videos.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/gallery/admin/files
//  Auth — lists all files in /uploads with pagination & type filter
// ─────────────────────────────────────────────────────────────
export const listUploadedFiles = (req, res) => {
    try {
        const { type, search } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 24);

        if (!fs.existsSync(UPLOADS_DIR)) {
            return successResponse(res, { files: [], total: 0, page, limit, totalPages: 0 });
        }

        const entries = fs.readdirSync(UPLOADS_DIR);

        // Build enriched list
        let files = entries
            .map(filename => {
                const filePath = path.join(UPLOADS_DIR, filename);
                let stat;
                try { stat = fs.statSync(filePath); } catch { return null; }
                if (!stat.isFile()) return null;
                const fileType = getFileType(filename);
                if (fileType === 'other') return null; // skip non-media
                return {
                    filename,
                    type: fileType,
                    url: `/uploads/${filename}`,
                    size: stat.size,
                    created_at: stat.birthtime || stat.mtime,
                };
            })
            .filter(Boolean);

        // Filter by type
        if (type === 'image' || type === 'video') {
            files = files.filter(f => f.type === type);
        }

        // Filter by search (filename)
        if (search) {
            const q = search.toLowerCase();
            files = files.filter(f => f.filename.toLowerCase().includes(q));
        }

        // Sort newest first
        files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const total = files.length;
        const totalPages = Math.ceil(total / limit);
        const paged = files.slice((page - 1) * limit, page * limit);

        return successResponse(res, { files: paged, total, page, limit, totalPages });
    } catch (err) {
        console.error('[listUploadedFiles]', err);
        return errorResponse(res, 'Failed to list uploaded files.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/gallery/admin/files/:filename
//  Auth — permanently removes a file from /uploads
// ─────────────────────────────────────────────────────────────
export const deleteUploadedFile = (req, res) => {
    try {
        const { filename } = req.params;

        // Security: prevent path traversal
        if (!filename || filename.includes('/') || filename.includes('..')) {
            return errorResponse(res, 'Invalid filename.', 400);
        }

        const filePath = path.join(UPLOADS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return errorResponse(res, 'File not found.', 404);
        }

        fs.unlinkSync(filePath);
        return successResponse(res, { filename }, 'File deleted successfully.');
    } catch (err) {
        console.error('[deleteUploadedFile]', err);
        return errorResponse(res, 'Failed to delete file.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/gallery/admin/media
//  Auth — flat paginated list from event_media, optional ?type=photo|video & ?search
// ─────────────────────────────────────────────────────────────
export const listAdminMedia = async (req, res) => {
    try {
        const { type, search } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 24);
        const offset = (page - 1) * limit;

        let where = 'WHERE 1=1';
        const params = [];

        if (type === 'photo' || type === 'video') {
            where += ' AND em.media_type = ?';
            params.push(type);
        }
        if (search) {
            const like = `%${search}%`;
            where += ' AND (e.event_name LIKE ? OR em.caption LIKE ?)';
            params.push(like, like);
        }

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM event_media em JOIN events e ON e.id = em.event_id ${where}`,
            params
        );

        const [rows] = await db.query(
            `SELECT
                em.id, em.media_type AS type, em.file_url, em.caption, em.created_at,
                e.id AS event_id, e.event_name, e.event_date
             FROM event_media em
             JOIN events e ON e.id = em.event_id
             ${where}
             ORDER BY em.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error('[listAdminMedia]', err);
        return errorResponse(res, 'Failed to list media.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/gallery/admin/media/:id
//  Auth — removes a row from event_media and deletes the file from disk
// ─────────────────────────────────────────────────────────────
export const deleteEventMedia = async (req, res) => {
    try {
        const { id } = req.params;
        const [[row]] = await db.query('SELECT * FROM event_media WHERE id = ?', [id]);
        if (!row) return errorResponse(res, 'Media not found.', 404);

        // Delete physical file
        if (row.file_url?.startsWith('/uploads/')) {
            const filePath = path.join(UPLOADS_DIR, path.basename(row.file_url));
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) { }
        }

        await db.query('DELETE FROM event_media WHERE id = ?', [id]);
        return successResponse(res, { id }, 'Media deleted successfully.');
    } catch (err) {
        console.error('[deleteEventMedia]', err);
        return errorResponse(res, 'Failed to delete media.');
    }
};
