import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';
import path from 'path';

const parseJson = (val, fallback = []) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

export const getCards = async (req, res) => {
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
        let query = 'SELECT * FROM ente_nadu_cards WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM ente_nadu_cards WHERE 1=1';
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
        return errorResponse(res, 'Failed to fetch cards');
    }
};

export const promoteCard = async (req, res) => {
    const { id } = req.params;
    try {
        // Step 1: Shift everyone's order up
        await pool.query('UPDATE ente_nadu_cards SET order_index = order_index + 1');
        // Step 2: Set target to 0
        await pool.query('UPDATE ente_nadu_cards SET order_index = 0 WHERE id = ?', [id]);

        return successResponse(res, {}, 'Card promoted to top successfully');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to promote card');
    }
};

export const createCard = async (req, res) => {
    const { title, description, icon_name, order_index } = req.body;
    
    try {
        // Determine icon URL
        let iconUrl = null;
        if (req.file) {
            // Use uploaded file
            iconUrl = req.file.location || `/uploads/ente-nadu-icons/${req.file.filename}`;
        }

        const [result] = await pool.query(
            'INSERT INTO ente_nadu_cards (title, description, icon_name, icon_url, order_index) VALUES (?, ?, ?, ?, ?)',
            [title, description, icon_name || 'Info', iconUrl, order_index || 0]
        );
        return successResponse(res, { id: result.insertId }, 'Card created successfully', 201);
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to create card');
    }
};

export const updateCard = async (req, res) => {
    const { id } = req.params;
    const { title, description, icon_name, order_index } = req.body;
    
    try {
        // Get current card to preserve icon_url if no new file
        let iconUrl = req.body.icon_url || null;
        
        if (req.file) {
            // Use new uploaded file
            iconUrl = req.file.location || `/uploads/ente-nadu-icons/${req.file.filename}`;
        }

        await pool.query(
            'UPDATE ente_nadu_cards SET title = ?, description = ?, icon_name = ?, icon_url = ?, order_index = ? WHERE id = ?',
            [title, description, icon_name, iconUrl, order_index, id]
        );
        return successResponse(res, {}, 'Card updated successfully');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to update card');
    }
};

export const deleteCard = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM ente_nadu_cards WHERE id = ?', [id]);
        return successResponse(res, {}, 'Card deleted successfully');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to delete card');
    }
};

// ── Section Meta ────────────────────────────────────────────────

// GET /api/ente-nadu/section (public)
export const getSectionMeta = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM ente_nadu_section WHERE id = 1');
        if (!rows.length) return successResponse(res, { data: null });
        const row = rows[0];
        row.buttons = parseJson(row.buttons, []);
        return successResponse(res, { data: row }, 'Ente Nadu section meta fetched.');
    } catch (err) {
        console.error('[getEnteNaduSectionMeta]', err);
        return errorResponse(res, 'Failed to fetch ente-nadu section meta.');
    }
};

// PUT /api/ente-nadu/section (protected)
export const updateSectionMeta = async (req, res) => {
    try {
        const { title, highlight_text, description, image_url, buttons } = req.body;
        const buttonsArr = Array.isArray(buttons) ? buttons.slice(0, 2) : [];

        await pool.query(
            `UPDATE ente_nadu_section SET title = ?, highlight_text = ?, description = ?, image_url = ?, buttons = ? WHERE id = 1`,
            [title || null, highlight_text || null, description || null, image_url || null, JSON.stringify(buttonsArr)]
        );

        const [rows] = await pool.query('SELECT * FROM ente_nadu_section WHERE id = 1');
        const row = rows[0];
        row.buttons = parseJson(row.buttons, []);
        return successResponse(res, { data: row }, 'Ente Nadu section meta updated.');
    } catch (err) {
        console.error('[updateEnteNaduSectionMeta]', err);
        return errorResponse(res, 'Failed to update ente-nadu section meta.');
    }
};

// POST /api/ente-nadu/section/upload (protected)
export const uploadSectionImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        const fileUrl = req.file.location || `/uploads/${req.file.filename}`;
        return successResponse(res, { url: fileUrl }, 'Section image uploaded.');
    } catch (err) {
        console.error('[uploadSectionImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Server error uploading image.');
    }
};
