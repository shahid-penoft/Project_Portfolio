import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const getMetrics = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM impact_metrics ORDER BY order_index ASC');
        return successResponse(res, { data: rows });
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to fetch impact metrics');
    }
};

export const createMetric = async (req, res) => {
    const { title, value, icon_name, order_index } = req.body;
    try {
        let iconUrl = null;
        if (req.file) {
            iconUrl = req.file.location || `/uploads/ente-nadu-icons/${req.file.filename}`;
        }

        const [result] = await pool.query(
            'INSERT INTO impact_metrics (title, value, icon_name, icon_url, order_index) VALUES (?, ?, ?, ?, ?)',
            [title, value, icon_name || 'Activity', iconUrl, order_index || 0]
        );
        return successResponse(res, { id: result.insertId }, 'Metric created successfully', 201);
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to create impact metric');
    }
};

export const updateMetric = async (req, res) => {
    const { id } = req.params;
    const { title, value, icon_name, order_index } = req.body;
    try {
        let iconUrl = (req.body.icon_url === 'null' || req.body.icon_url === '') ? null : (req.body.icon_url || null);
        if (req.file) {
            iconUrl = req.file.location || `/uploads/ente-nadu-icons/${req.file.filename}`;
        }

        await pool.query(
            'UPDATE impact_metrics SET title = ?, value = ?, icon_name = ?, icon_url = ?, order_index = ? WHERE id = ?',
            [title, value, icon_name, iconUrl, order_index, id]
        );
        return successResponse(res, {}, 'Metric updated successfully');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to update impact metric');
    }
};

export const deleteMetric = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM impact_metrics WHERE id = ?', [id]);
        return successResponse(res, {}, 'Metric deleted successfully');
    } catch (err) {
        console.error(err);
        return errorResponse(res, 'Failed to delete impact metric');
    }
};
