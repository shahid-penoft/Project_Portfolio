import db from '../configs/db.js';

// @desc    Get all recognitions
// @route   GET /api/recognitions
// @access  Public
export const getAllRecognitions = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM recognitions ORDER BY order_index ASC, id DESC');
        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Error fetching recognitions:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create a new recognition
// @route   POST /api/recognitions
// @access  Private (Admin)
export const createRecognition = async (req, res) => {
    try {
        const { description, icon_name, order_index } = req.body;

        if (!description) {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }

        const safeIcon = icon_name || 'Activity';
        const safeOrder = order_index || 0;

        const [result] = await db.query(
            'INSERT INTO recognitions (description, icon_name, order_index) VALUES (?, ?, ?)',
            [description, safeIcon, safeOrder]
        );

        res.status(201).json({
            success: true,
            message: 'Recognition created successfully',
            data: { id: result.insertId, description, icon_name: safeIcon, order_index: safeOrder }
        });
    } catch (error) {
        console.error('Error creating recognition:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update a recognition
// @route   PUT /api/recognitions/:id
// @access  Private (Admin)
export const updateRecognition = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, icon_name, order_index } = req.body;

        const [existing] = await db.query('SELECT * FROM recognitions WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Recognition not found' });
        }
        const rec = existing[0];

        await db.query(
            'UPDATE recognitions SET description = ?, icon_name = ?, order_index = ? WHERE id = ?',
            [
                description !== undefined ? description : rec.description,
                icon_name !== undefined ? icon_name : rec.icon_name,
                order_index !== undefined ? order_index : rec.order_index,
                id
            ]
        );

        res.status(200).json({ success: true, message: 'Recognition updated successfully' });
    } catch (error) {
        console.error('Error updating recognition:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a recognition
// @route   DELETE /api/recognitions/:id
// @access  Private (Admin)
export const deleteRecognition = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await db.query('SELECT * FROM recognitions WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Recognition not found' });
        }

        await db.query('DELETE FROM recognitions WHERE id = ?', [id]);
        res.status(200).json({ success: true, message: 'Recognition deleted successfully' });
    } catch (error) {
        console.error('Error deleting recognition:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Promote a recognition to the top (order_index = 0)
// @route   PUT /api/recognitions/:id/promote
// @access  Private (Admin)
export const promoteRecognition = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        const [existing] = await connection.query('SELECT * FROM recognitions WHERE id = ?', [id]);
        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Recognition not found' });
        }

        await connection.query('UPDATE recognitions SET order_index = order_index + 1 WHERE id != ?', [id]);
        await connection.query('UPDATE recognitions SET order_index = 0 WHERE id = ?', [id]);

        await connection.commit();
        res.status(200).json({ success: true, message: 'Recognition promoted to top' });
    } catch (error) {
        await connection.rollback();
        console.error('Error promoting recognition:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    } finally {
        connection.release();
    }
};
