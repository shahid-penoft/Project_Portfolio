import db from '../configs/db.js';
import { uploadImage, runMulter } from '../configs/multer.js';
import fs from 'fs';
import path from 'path';

// @desc    Get all timelines
// @route   GET /api/timeline
// @access  Public
export const getAllTimelines = async (req, res) => {
    try {
        const [timelines] = await db.query('SELECT * FROM timelines ORDER BY year DESC, created_at DESC');
        res.status(200).json({ success: true, count: timelines.length, data: timelines });
    } catch (error) {
        console.error('Error fetching timelines:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create a new timeline
// @route   POST /api/timeline
// @access  Private (Admin)
export const createTimeline = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);

        const { year, title } = req.body;

        if (!year || !title) {
            return res.status(400).json({ success: false, message: 'Year and title are required' });
        }

        const image_url = req.file ? `/uploads/${req.file.filename}` : null;

        const [result] = await db.query(
            'INSERT INTO timelines (year, title, image_url) VALUES (?, ?, ?)',
            [year, title, image_url]
        );

        res.status(201).json({
            success: true,
            message: 'Timeline created successfully',
            data: { id: result.insertId, year, title, image_url }
        });
    } catch (error) {
        console.error('Error creating timeline:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update a timeline
// @route   PUT /api/timeline/:id
// @access  Private (Admin)
export const updateTimeline = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);

        const { id } = req.params;
        const { year, title } = req.body;

        const [existing] = await db.query('SELECT * FROM timelines WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Timeline not found' });
        }

        const timeline = existing[0];
        let image_url = timeline.image_url;

        if (req.file) {
            image_url = `/uploads/${req.file.filename}`;
            // optionally delete old image
            if (timeline.image_url) {
                const oldPath = path.join(process.cwd(), timeline.image_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        await db.query(
            'UPDATE timelines SET year = ?, title = ?, image_url = ? WHERE id = ?',
            [year || timeline.year, title || timeline.title, image_url, id]
        );

        res.status(200).json({
            success: true,
            message: 'Timeline updated successfully',
            data: { id, year: year || timeline.year, title: title || timeline.title, image_url }
        });
    } catch (error) {
        console.error('Error updating timeline:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a timeline
// @route   DELETE /api/timeline/:id
// @access  Private (Admin)
export const deleteTimeline = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT * FROM timelines WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Timeline not found' });
        }

        const timeline = existing[0];

        if (timeline.image_url) {
            const oldPath = path.join(process.cwd(), timeline.image_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await db.query('DELETE FROM timelines WHERE id = ?', [id]);

        res.status(200).json({ success: true, message: 'Timeline deleted successfully' });
    } catch (error) {
        console.error('Error deleting timeline:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
