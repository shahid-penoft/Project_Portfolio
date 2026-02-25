import db from '../configs/db.js';
import { uploadVisualStoryFiles, runMulter } from '../configs/multer.js';
import fs from 'fs';
import path from 'path';

// @desc    Get all visual stories
// @route   GET /api/visual-stories
// @access  Public
export const getAllStories = async (req, res) => {
    try {
        const [stories] = await db.query('SELECT * FROM visual_stories ORDER BY order_index ASC, created_at DESC');
        res.status(200).json({ success: true, count: stories.length, data: stories });
    } catch (error) {
        console.error('Error fetching visual stories:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create a new visual story
// @route   POST /api/visual-stories
// @access  Private (Admin)
export const createStory = async (req, res) => {
    try {
        await runMulter(uploadVisualStoryFiles, req, res);

        const { title, description, video_type, video_url } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        let final_video_url = video_url || '';
        let thumbnail_url = null;

        if (req.files) {
            if (req.files.video && req.files.video.length > 0) {
                final_video_url = `/uploads/${req.files.video[0].filename}`;
            }
            if (req.files.thumbnail && req.files.thumbnail.length > 0) {
                thumbnail_url = `/uploads/${req.files.thumbnail[0].filename}`;
            }
        }

        if (video_type === 'upload' && !final_video_url) {
            return res.status(400).json({ success: false, message: 'A video file must be uploaded when video_type is upload' });
        }

        const [maxResult] = await db.query('SELECT MAX(order_index) as maxOrder FROM visual_stories');
        const nextOrderIndex = (maxResult[0].maxOrder !== null ? maxResult[0].maxOrder : -1) + 1;

        const [result] = await db.query(
            'INSERT INTO visual_stories (title, description, video_type, video_url, thumbnail_url, order_index) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description || null, video_type || 'url', final_video_url, thumbnail_url, nextOrderIndex]
        );

        res.status(201).json({
            success: true,
            message: 'Visual story created successfully',
            data: { id: result.insertId, title, description, video_type, video_url: final_video_url, thumbnail_url, order_index: nextOrderIndex }
        });
    } catch (error) {
        console.error('Error creating visual story:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Update a visual story
// @route   PUT /api/visual-stories/:id
// @access  Private (Admin)
export const updateStory = async (req, res) => {
    try {
        await runMulter(uploadVisualStoryFiles, req, res);

        const { id } = req.params;
        const { title, description, video_type, video_url, order_index } = req.body;

        const [existing] = await db.query('SELECT * FROM visual_stories WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Visual story not found' });
        }

        const story = existing[0];
        let final_video_url = story.video_url;
        let final_thumbnail_url = story.thumbnail_url;

        // If explicitly passing a string for video_url (e.g. changing from upload to youtube)
        if (video_type === 'url' && video_url !== undefined) {
            final_video_url = video_url;
        }

        if (req.files) {
            if (req.files.video && req.files.video.length > 0) {
                final_video_url = `/uploads/${req.files.video[0].filename}`;
                // Optionally delete old video if it was an upload
                if (story.video_type === 'upload' && story.video_url) {
                    const oldPath = path.join(process.cwd(), story.video_url);
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }
            }
            if (req.files.thumbnail && req.files.thumbnail.length > 0) {
                final_thumbnail_url = `/uploads/${req.files.thumbnail[0].filename}`;
                // Delete old thumbnail
                if (story.thumbnail_url) {
                    const oldPath = path.join(process.cwd(), story.thumbnail_url);
                    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                }
            }
        }

        const final_order_index = order_index !== undefined ? parseInt(order_index, 10) : story.order_index;

        await db.query(
            'UPDATE visual_stories SET title = ?, description = ?, video_type = ?, video_url = ?, thumbnail_url = ?, order_index = ? WHERE id = ?',
            [
                title || story.title,
                description !== undefined ? description : story.description,
                video_type || story.video_type,
                final_video_url,
                final_thumbnail_url,
                final_order_index,
                id
            ]
        );

        res.status(200).json({
            success: true,
            message: 'Visual story updated successfully'
        });
    } catch (error) {
        console.error('Error updating visual story:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a visual story
// @route   DELETE /api/visual-stories/:id
// @access  Private (Admin)
export const deleteStory = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT * FROM visual_stories WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Visual story not found' });
        }

        const story = existing[0];

        if (story.video_type === 'upload' && story.video_url) {
            const oldPath = path.join(process.cwd(), story.video_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        if (story.thumbnail_url) {
            const oldPath = path.join(process.cwd(), story.thumbnail_url);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await db.query('DELETE FROM visual_stories WHERE id = ?', [id]);

        res.status(200).json({ success: true, message: 'Visual story deleted successfully' });
    } catch (error) {
        console.error('Error deleting visual story:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
