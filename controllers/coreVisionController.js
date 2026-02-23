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
    fs.unlink(filePath, () => { }); // best-effort
};

// ── Pillars ────────────────────────────────────────────────────
export const uploadPillarImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: `/uploads/${req.file.filename}` }, 'Image uploaded.');
    } catch (err) {
        console.error('[uploadPillarImage]', err);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

export const getPillars = async (req, res) => {
    const { search, page = 1, limit = 10 } = req.query;
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

export const createPillar = async (req, res) => {
    const { title, description, image_url, order_index } = req.body;
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
    const { title, description, image_url, order_index } = req.body;
    try {
        const [oldRows] = await pool.query('SELECT image_url FROM core_vision_pillars WHERE id = ?', [id]);
        if (oldRows.length && oldRows[0].image_url && oldRows[0].image_url !== image_url) {
            deleteFile(oldRows[0].image_url);
        }

        await pool.query(
            'UPDATE core_vision_pillars SET title = ?, description = ?, image_url = ?, order_index = ? WHERE id = ?',
            [title, description, image_url, order_index, id]
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
