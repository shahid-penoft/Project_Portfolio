import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

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
        const [result] = await pool.query(
            'INSERT INTO ente_nadu_cards (title, description, icon_name, order_index) VALUES (?, ?, ?, ?)',
            [title, description, icon_name || 'Info', order_index || 0]
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
        await pool.query(
            'UPDATE ente_nadu_cards SET title = ?, description = ?, icon_name = ?, order_index = ? WHERE id = ?',
            [title, description, icon_name, order_index, id]
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
