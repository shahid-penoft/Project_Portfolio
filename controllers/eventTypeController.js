import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// GET /api/event-types
export const getAllEventTypes = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM event_types ORDER BY type_name ASC');
        return successResponse(res, { data: rows }, 'Event types fetched successfully.');
    } catch (err) {
        console.error('[getAllEventTypes]', err);
        return errorResponse(res, 'Server error fetching event types.');
    }
};

// POST /api/event-types
export const createEventType = async (req, res) => {
    try {
        const { type_name, description } = req.body;
        if (!type_name) return errorResponse(res, 'type_name is required.', 400);

        const [result] = await db.query(
            'INSERT INTO event_types (type_name, description) VALUES (?, ?)',
            [type_name.trim(), description || null]
        );
        const [rows] = await db.query('SELECT * FROM event_types WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Event type created successfully.', 201);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'An event type with this name already exists.', 409);
        console.error('[createEventType]', err);
        return errorResponse(res, 'Server error creating event type.');
    }
};

// PUT /api/event-types/:id
export const updateEventType = async (req, res) => {
    try {
        const { id } = req.params;
        const { type_name, description } = req.body;
        if (!type_name) return errorResponse(res, 'type_name is required.', 400);

        const [result] = await db.query(
            'UPDATE event_types SET type_name = ?, description = ? WHERE id = ?',
            [type_name.trim(), description || null, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Event type not found.', 404);
        const [rows] = await db.query('SELECT * FROM event_types WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Event type updated successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'An event type with this name already exists.', 409);
        console.error('[updateEventType]', err);
        return errorResponse(res, 'Server error updating event type.');
    }
};

// DELETE /api/event-types/:id
export const deleteEventType = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM event_types WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return errorResponse(res, 'Event type not found.', 404);
        return successResponse(res, {}, 'Event type deleted successfully.');
    } catch (err) {
        console.error('[deleteEventType]', err);
        return errorResponse(res, 'Server error deleting event type.');
    }
};
