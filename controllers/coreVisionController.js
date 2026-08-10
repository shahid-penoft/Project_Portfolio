import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

const parseJson = (val, fallback = []) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

const deleteFile = (url) => {
    if (!url || !url.startsWith('/uploads/')) return;
    const filePath = path.join(uploadDir, path.basename(url));
    fs.unlink(filePath, () => { }); // best-effort
};

// ── Pillars ────────────────────────────────────────────────────
export const uploadPillarImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: req.file.location || `/uploads/${req.file.filename}` }, 'Image uploaded.');
    } catch (err) {
        console.error('[uploadPillarImage]', err);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

export const getPillars = async (req, res) => {
    const { search } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    try {
        let query = 'SELECT * FROM core_vision_pillars WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM core_vision_pillars WHERE 1=1';
        const queryParams = [];

        if (search) {
            const searchPattern = `%${search}%`;
            query += ' AND (title LIKE ? OR description LIKE ?)';
            countQuery += ' AND (title LIKE ? OR description LIKE ?)';
            queryParams.push(searchPattern, searchPattern);
        }

        query += ' ORDER BY order_index ASC LIMIT ? OFFSET ?';
        const [rows] = await pool.query(query, [...queryParams, parseInt(limit), parseInt(offset)]);
        const [[{ total }]] = await pool.query(countQuery, queryParams);

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to fetch pillars');
    }
};

const capitalizeFirstLetter = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const createPillar = async (req, res) => {
    let { title, description, image_url, order_index } = req.body;
    title = capitalizeFirstLetter(title);
    description = capitalizeFirstLetter(description);
    try {
        const [result] = await pool.query(
            'INSERT INTO core_vision_pillars (title, description, image_url, order_index) VALUES (?, ?, ?, ?)',
            [title, description, image_url, order_index || 0]
        );
        return successResponse(res, { id: result.insertId }, 'Pillar created successfully', 201);
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to create pillar');
    }
};

export const updatePillar = async (req, res) => {
    const { id } = req.params;
    let { title, description, image_url, order_index } = req.body;
    title = capitalizeFirstLetter(title);
    description = capitalizeFirstLetter(description);
    try {
        const [oldRows] = await pool.query('SELECT image_url, order_index FROM core_vision_pillars WHERE id = ?', [id]);
        if (oldRows.length && oldRows[0].image_url && oldRows[0].image_url !== image_url) {
            deleteFile(oldRows[0].image_url);
        }

        const finalOrderIndex = order_index !== undefined ? order_index : (oldRows.length ? oldRows[0].order_index : 0);

        await pool.query(
            'UPDATE core_vision_pillars SET title = ?, description = ?, image_url = ?, order_index = ? WHERE id = ?',
            [title, description, image_url, finalOrderIndex, id]
        );
        return successResponse(res, {}, 'Pillar updated successfully');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to update pillar');
    }
};

export const deletePillar = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT image_url FROM core_vision_pillars WHERE id = ?', [id]);
        if (rows.length && rows[0].image_url) {
            deleteFile(rows[0].image_url);
        }

        await pool.query('DELETE FROM core_vision_pillars WHERE id = ?', [id]);
        return successResponse(res, {}, 'Pillar deleted successfully');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to delete pillar');
    }
};

export const promotePillar = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE core_vision_pillars SET order_index = order_index + 1');
        await pool.query('UPDATE core_vision_pillars SET order_index = 0 WHERE id = ?', [id]);
        return successResponse(res, {}, 'Pillar promoted to top');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to promote pillar');
    }
};

// ── Section Meta ────────────────────────────────────────────────

// GET /api/core-vision/section (public)
export const getSectionMeta = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM core_vision_section WHERE id = 1');
        if (!rows.length) return successResponse(res, { data: null });
        const row = rows[0];
        row.buttons = parseJson(row.buttons, []);
        return successResponse(res, { data: row }, 'Core vision section meta fetched.');
    } catch (err) {
        console.error('[getSectionMeta]', err);
        return errorResponse(res, 'Failed to fetch core vision section meta.');
    }
};

// PUT /api/core-vision/section (protected)
export const updateSectionMeta = async (req, res) => {
    try {
        const { title, description, quote, buttons } = req.body;
        const buttonsArr = Array.isArray(buttons) ? buttons.slice(0, 2) : [];

        await pool.query(
            `UPDATE core_vision_section SET title = ?, description = ?, quote = ?, buttons = ? WHERE id = 1`,
            [title || null, description || null, quote || null, JSON.stringify(buttonsArr)]
        );

        const [rows] = await pool.query('SELECT * FROM core_vision_section WHERE id = 1');
        const row = rows[0];
        row.buttons = parseJson(row.buttons, []);
        return successResponse(res, { data: row }, 'Core vision section meta updated.');
    } catch (err) {
        console.error('[updateSectionMeta]', err);
        return errorResponse(res, 'Failed to update core vision section meta.');
    }
};
