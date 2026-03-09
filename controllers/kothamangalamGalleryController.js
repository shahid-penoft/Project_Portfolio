import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadMediaFields, runMulter } from '../configs/multer.js';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────
//  Public: GET /api/kothamangalam-gallery/images
// ─────────────────────────────────────────────────────────────
export const getKothamangalamImages = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 24);
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM kothamangalam_gallery WHERE media_type = 'photo'`
        );

        const [rows] = await db.query(
            `SELECT * FROM kothamangalam_gallery WHERE media_type = 'photo' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }, 'Images fetched successfully.');
    } catch (err) {
        console.error('[getKothamangalamImages]', err);
        return errorResponse(res, 'Server error fetching images.');
    }
};

// ─────────────────────────────────────────────────────────────
//  Public: GET /api/kothamangalam-gallery/videos
// ─────────────────────────────────────────────────────────────
export const getKothamangalamVideos = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 24);
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM kothamangalam_gallery WHERE media_type = 'video'`
        );

        const [rows] = await db.query(
            `SELECT * FROM kothamangalam_gallery WHERE media_type = 'video' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }, 'Videos fetched successfully.');
    } catch (err) {
        console.error('[getKothamangalamVideos]', err);
        return errorResponse(res, 'Server error fetching videos.');
    }
};

// ─────────────────────────────────────────────────────────────
//  Admin: GET /api/kothamangalam-gallery/admin
// ─────────────────────────────────────────────────────────────
export const getAllAdminGallery = async (req, res) => {
    try {
        const { type } = req.query; // 'photo' | 'video' | undefined
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, parseInt(req.query.limit, 10) || 24);
        const offset = (page - 1) * limit;

        let whereStr = 'WHERE 1=1';
        const params = [];

        if (type === 'photo' || type === 'video') {
            whereStr += ' AND media_type = ?';
            params.push(type);
        }

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM kothamangalam_gallery ${whereStr}`,
            params
        );

        const query = `
            SELECT * FROM kothamangalam_gallery 
            ${whereStr} 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.query(query, [...params, limit, offset]);

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error('[getAllAdminGallery]', err);
        return errorResponse(res, 'Server error fetching admin gallery.');
    }
};

// ─── Admin: POST /api/kothamangalam-gallery/admin/upload ───────
export const createGalleryItem = async (req, res) => {
    try {
        await runMulter(uploadMediaFields, req, res);

        // Robust initialization
        if (!req.body) req.body = {};

        const { media_type, video_type, title, description } = req.body;
        let { file_url, thumbnail_url } = req.body;

        if (!media_type || !['photo', 'video'].includes(media_type)) {
            return errorResponse(res, "Invalid or missing media_type ('photo' or 'video').", 400);
        }
        if (!title) {
            return errorResponse(res, "title is required.", 400);
        }

        // Handle uploaded files
        if (req.files) {
            if (req.files.file?.[0]) {
                file_url = `/uploads/${req.files.file[0].filename}`;
            }
            if (req.files.thumbnail?.[0]) {
                thumbnail_url = `/uploads/${req.files.thumbnail[0].filename}`;
            }
        }

        // For video URL type, ensure we take the URL from the body if not uploaded
        if (media_type === 'video' && video_type === 'url' && req.body.video_url) {
            file_url = req.body.video_url;
        }

        if (!file_url) {
            return errorResponse(res, "Media file or file_url is required.", 400);
        }

        const query = `
            INSERT INTO kothamangalam_gallery (media_type, video_type, title, description, file_url, thumbnail_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.query(query, [
            media_type,
            video_type || 'upload',
            title,
            description || null,
            file_url,
            thumbnail_url || null
        ]);

        return successResponse(res, { id: result.insertId }, 'Gallery item created successfully.', 201);
    } catch (err) {
        console.error('[createGalleryItem]', err);
        return errorResponse(res, 'Server error creating gallery item.');
    }
};

// ─── Admin: PUT /api/kothamangalam-gallery/admin/:id ───────────
export const updateGalleryItem = async (req, res) => {
    try {
        await runMulter(uploadMediaFields, req, res);

        // Robust initialization
        if (!req.body) req.body = {};

        const { id } = req.params;
        const { media_type, video_type, title, description } = req.body;
        let { file_url, thumbnail_url } = req.body;

        const [existing] = await db.query('SELECT * FROM kothamangalam_gallery WHERE id = ?', [id]);
        if (existing.length === 0) {
            return errorResponse(res, 'Gallery item not found.', 404);
        }
        const item = existing[0];

        // Handle uploaded files
        if (req.files) {
            if (req.files.file?.[0]) {
                file_url = `/uploads/${req.files.file[0].filename}`;
                // Delete old file if it was an upload
                if (item.file_url?.startsWith('/uploads/')) {
                    const oldPath = path.join(process.cwd(), item.file_url);
                    if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (_) { }
                }
            }
            if (req.files.thumbnail?.[0]) {
                thumbnail_url = `/uploads/${req.files.thumbnail[0].filename}`;
                // Delete old thumbnail
                if (item.thumbnail_url?.startsWith('/uploads/')) {
                    const oldPath = path.join(process.cwd(), item.thumbnail_url);
                    if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (_) { }
                }
            }
        }

        // For video URL type, ensure we take the URL from the body if not uploaded
        if ((media_type === 'video' || item.media_type === 'video') &&
            (video_type === 'url' || item.video_type === 'url') && req.body.video_url) {
            file_url = req.body.video_url;
        }

        const query = `
            UPDATE kothamangalam_gallery
            SET media_type = ?, video_type = ?, title = ?, description = ?, file_url = ?, thumbnail_url = ?
            WHERE id = ?
        `;
        await db.query(query, [
            media_type || item.media_type,
            video_type || item.video_type,
            title || item.title,
            description !== undefined ? description : item.description,
            file_url || item.file_url,
            thumbnail_url || item.thumbnail_url,
            id
        ]);

        return successResponse(res, { id }, 'Gallery item updated successfully.');
    } catch (err) {
        console.error('[updateGalleryItem]', err);
        return errorResponse(res, 'Server error updating gallery item.');
    }
};

// ─── Admin: DELETE /api/kothamangalam-gallery/admin/:id ────────
export const deleteGalleryItem = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT * FROM kothamangalam_gallery WHERE id = ?', [id]);
        if (existing.length === 0) {
            return errorResponse(res, 'Gallery item not found.', 404);
        }
        const item = existing[0];

        // Delete physical files
        if (item.file_url?.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), item.file_url);
            if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) { }
        }
        if (item.thumbnail_url?.startsWith('/uploads/')) {
            const thumbPath = path.join(process.cwd(), item.thumbnail_url);
            if (fs.existsSync(thumbPath)) try { fs.unlinkSync(thumbPath); } catch (_) { }
        }

        await db.query(`DELETE FROM kothamangalam_gallery WHERE id = ?`, [id]);

        return successResponse(res, { id }, 'Gallery item deleted successfully.');
    } catch (err) {
        console.error('[deleteGalleryItem]', err);
        return errorResponse(res, 'Server error deleting gallery item.');
    }
};
