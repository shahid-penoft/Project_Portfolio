import db from '../configs/db.js';
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

// POST /api/sectors/upload  (admin)
export const uploadSectorImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: `/uploads/${req.file.filename}` }, 'Image uploaded.');
    } catch (err) {
        console.error('[uploadSectorImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// GET /api/sectors
export const getAllSectors = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sectors ORDER BY display_order ASC, id ASC');
        return successResponse(res, { data: rows }, 'Sectors fetched successfully.');
    } catch (err) {
        console.error('[getAllSectors]', err);
        return errorResponse(res, 'Server error fetching sectors.');
    }
};

// POST /api/sectors
export const createSector = async (req, res) => {
    try {
        const { name, description, image_url } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        // Auto-assign display_order as next in sequence
        const [[{ maxOrder }]] = await db.query('SELECT COALESCE(MAX(display_order), -1) + 1 AS maxOrder FROM sectors');

        const [result] = await db.query(
            'INSERT INTO sectors (name, description, image_url, display_order) VALUES (?, ?, ?, ?)',
            [name.trim(), description || null, image_url || null, maxOrder]
        );
        const [rows] = await db.query('SELECT * FROM sectors WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Sector created successfully.', 201);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A sector with this name already exists.', 409);
        console.error('[createSector]', err);
        return errorResponse(res, 'Server error creating sector.');
    }
};

// PUT /api/sectors/:id
export const updateSector = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, image_url, display_order } = req.body;
        if (!name) return errorResponse(res, 'name is required.', 400);

        const [result] = await db.query(
            'UPDATE sectors SET name = ?, description = ?, image_url = ?, display_order = ? WHERE id = ?',
            [
                name.trim(),
                description || null,
                image_url !== undefined ? image_url : null,
                display_order !== undefined ? display_order : 0,
                id
            ]
        );
        if (!result.affectedRows) return errorResponse(res, 'Sector not found.', 404);
        const [rows] = await db.query('SELECT * FROM sectors WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Sector updated successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A sector with this name already exists.', 409);
        console.error('[updateSector]', err);
        return errorResponse(res, 'Server error updating sector.');
    }
};

// DELETE /api/sectors/:id
export const deleteSector = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT image_url FROM sectors WHERE id = ?', [req.params.id]);
        if (!rows.length) return errorResponse(res, 'Sector not found.', 404);

        // Clean up image file on delete
        if (rows[0].image_url) deleteFile(rows[0].image_url);

        const [result] = await db.query('DELETE FROM sectors WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return errorResponse(res, 'Sector not found.', 404);
        return successResponse(res, {}, 'Sector deleted successfully.');
    } catch (err) {
        console.error('[deleteSector]', err);
        return errorResponse(res, 'Server error deleting sector.');
    }
};
