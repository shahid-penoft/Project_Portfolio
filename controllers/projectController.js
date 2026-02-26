import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

// ── Helpers ────────────────────────────────────────────────────
const parseImages = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
};

const deleteFile = (url) => {
    if (!url || !url.startsWith('/uploads/')) return;
    const filePath = path.join(uploadDir, path.basename(url));
    fs.unlink(filePath, () => { }); // best-effort
};

// ── POST /api/projects/upload  (admin) ─────────────────────────
export const uploadProjectImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: `/uploads/${req.file.filename}` }, 'Image uploaded.');
    } catch (err) {
        console.error('[uploadProjectImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// ── POST /api/projects/:id/upload-inline-image (admin) ─────────
export const uploadProjectInlineImage = async (req, res) => {
    try {
        console.log('[uploadProjectInlineImage] Starting upload for ID:', req.params.id);
        await runMulter(uploadImage, req, res);

        if (!req.file) {
            console.error('[uploadProjectInlineImage] No file in request');
            return errorResponse(res, 'No image file uploaded.', 400);
        }

        const { id } = req.params;
        // Check project exists
        const [rows] = await db.query('SELECT id FROM projects WHERE id = ?', [id]);
        if (!rows.length) {
            console.error('[uploadProjectInlineImage] Project not found for ID:', id);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return errorResponse(res, 'Project not found.', 404);
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;
        console.log('[uploadProjectInlineImage] Success, URL:', fullUrl);
        return successResponse(res, { url: fullUrl }, 'Image uploaded for editor.');
    } catch (err) {
        console.error('[uploadProjectInlineImage] Error trapped:', err);
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Server error uploading image.');
    }
};

// ── GET /api/projects/all  (admin, paginated) ──────────────────
export const getAllProjects = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;
        const { search, sector_id, local_body_id, year, is_active } = req.query;

        const conditions = [];
        const vals = [];

        if (search) { conditions.push('(p.title LIKE ? OR p.tags LIKE ?)'); vals.push(`%${search}%`, `%${search}%`); }
        if (sector_id) { conditions.push('p.sector_id = ?'); vals.push(sector_id); }
        if (local_body_id) { conditions.push('p.local_body_id = ?'); vals.push(local_body_id); }
        if (year) { conditions.push('p.year = ?'); vals.push(year); }
        if (is_active !== undefined && is_active !== '') { conditions.push('p.is_active = ?'); vals.push(is_active); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM projects p ${where}`, vals
        );
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             ${where}
             ORDER BY p.display_order ASC, p.created_at DESC
             LIMIT ? OFFSET ?`,
            [...vals, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Projects fetched.');
    } catch (err) {
        console.error('[getAllProjects]', err);
        return errorResponse(res, 'Server error fetching projects.');
    }
};

// ── GET /api/projects/:id  ─────────────────────────────────────
export const getProjectById = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             WHERE p.id = ?`, [req.params.id]
        );
        if (!rows.length) return errorResponse(res, 'Project not found.', 404);
        return successResponse(res, { data: rows[0] }, 'Project fetched.');
    } catch (err) {
        console.error('[getProjectById]', err);
        return errorResponse(res, 'Server error.');
    }
};

// ── POST /api/projects  ────────────────────────────────────────
export const createProject = async (req, res) => {
    try {
        const {
            title, description, project_content, images = [], tags,
            year, sector_id, local_body_id,
            display_order = 0, is_active = 1,
        } = req.body;

        if (!title?.trim()) return errorResponse(res, 'Title is required.', 400);

        const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);
        const [result] = await db.query(
            `INSERT INTO projects (title, description, project_content, images, tags, year, sector_id, local_body_id, display_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title.trim(), description || null, project_content || null, imagesJson, tags || null, year || null,
            sector_id || null, local_body_id || null, display_order, is_active ? 1 : 0]
        );
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name
             FROM projects p
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             WHERE p.id = ?`, [result.insertId]
        );
        return successResponse(res, { data: rows[0] }, 'Project created.', 201);
    } catch (err) {
        console.error('[createProject]', err);
        return errorResponse(res, 'Server error creating project.');
    }
};

// ── PUT /api/projects/:id  ─────────────────────────────────────
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, project_content, images = [], tags,
            year, sector_id, local_body_id,
            display_order = 0, is_active = 1,
        } = req.body;

        if (!title?.trim()) return errorResponse(res, 'Title is required.', 400);

        const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);
        const [result] = await db.query(
            `UPDATE projects SET title=?, description=?, project_content=?, images=?, tags=?, year=?,
             sector_id=?, local_body_id=?, display_order=?, is_active=?, updated_at=NOW()
             WHERE id=?`,
            [title.trim(), description || null, project_content || null, imagesJson, tags || null, year || null,
            sector_id || null, local_body_id || null, display_order, is_active ? 1 : 0, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Project not found.', 404);
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name
             FROM projects p
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             WHERE p.id = ?`, [id]
        );
        return successResponse(res, { data: rows[0] }, 'Project updated.');
    } catch (err) {
        console.error('[updateProject]', err);
        return errorResponse(res, 'Server error updating project.');
    }
};

// ── DELETE /api/projects/:id  ──────────────────────────────────
export const deleteProject = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT images FROM projects WHERE id = ?', [req.params.id]);
        if (!rows.length) return errorResponse(res, 'Project not found.', 404);

        // Delete image files from disk
        parseImages(rows[0].images).forEach(deleteFile);

        await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
        return successResponse(res, {}, 'Project deleted.');
    } catch (err) {
        console.error('[deleteProject]', err);
        return errorResponse(res, 'Server error deleting project.');
    }
};
