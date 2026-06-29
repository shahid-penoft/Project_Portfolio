import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadMediaArray } from '../configs/multerS3.js';

export const getUpdates = async (req, res) => {
    try {
        const { id } = req.params;
        const [updates] = await db.query(
            `SELECT u.*, au.full_name as author_name 
             FROM project_updates u 
             LEFT JOIN admin_users au ON u.created_by = au.id 
             WHERE project_id = ? ORDER BY u.created_at DESC`, [id]
        );

        if (updates.length > 0) {
            const updateIds = updates.map(u => u.id);
            const [media] = await db.query('SELECT * FROM project_update_media WHERE update_id IN (?)', [updateIds]);
            updates.forEach(u => {
                u.media = media.filter(m => m.update_id === u.id);
            });
        }

        return successResponse(res, { data: updates }, 'Updates fetched.');
    } catch (err) {
        console.error('[getUpdates]', err);
        return errorResponse(res, 'Server error fetching updates.');
    }
};

export const addUpdate = async (req, res) => {
    try {
        await runMulter(uploadMediaArray, req, res);
        const { id } = req.params;
        const { type, title, note } = req.body;

        if (!title?.trim() || !type?.trim() || !note?.trim()) {
            return errorResponse(res, 'Type, title, and note are required.', 400);
        }

        const created_by = req.user?.id || null;

        const [result] = await db.query(
            `INSERT INTO project_updates (project_id, type, title, note, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [id, type.trim(), title.trim(), note.trim(), created_by]
        );
        const updateId = result.insertId;

        // Process media
        if (req.files && req.files.length > 0) {
            const mediaValues = req.files.map(f => {
                const isVideo = f.mimetype.startsWith('video/');
                const isImage = f.mimetype.startsWith('image/');
                const mType = isImage ? 'photo' : (isVideo ? 'video' : 'attachment');
                const fileUrl = f.location || `/uploads/${f.filename}`;
                const sizeStr = (f.size / (1024 * 1024)).toFixed(2) + ' MB';
                return [updateId, mType, fileUrl, f.originalname, sizeStr];
            });

            await db.query(
                `INSERT INTO project_update_media (update_id, media_type, file_url, file_name, file_size) VALUES ?`,
                [mediaValues]
            );
        }

        const [rows] = await db.query('SELECT * FROM project_updates WHERE id = ?', [updateId]);
        const newUpdate = rows[0];
        const [media] = await db.query('SELECT * FROM project_update_media WHERE update_id = ?', [updateId]);
        newUpdate.media = media;

        return successResponse(res, { data: newUpdate }, 'Update added.', 201);
    } catch (err) {
        console.error('[addUpdate]', err);
        return errorResponse(res, 'Server error adding update.');
    }
};

export const deleteUpdate = async (req, res) => {
    try {
        const { id, uid } = req.params;
        const [result] = await db.query('DELETE FROM project_updates WHERE id = ? AND project_id = ?', [uid, id]);
        if (!result.affectedRows) return errorResponse(res, 'Update not found.', 404);
        return successResponse(res, {}, 'Update deleted.');
    } catch (err) {
        console.error('[deleteUpdate]', err);
        return errorResponse(res, 'Server error deleting update.');
    }
};

export const updateUpdate = async (req, res) => {
    try {
        await runMulter(uploadMediaArray, req, res);
        const { id, uid } = req.params;
        const { type, title, note } = req.body;

        if (!title?.trim() || !type?.trim() || !note?.trim()) {
            return errorResponse(res, 'Type, title, and note are required.', 400);
        }

        const [result] = await db.query(
            `UPDATE project_updates SET type = ?, title = ?, note = ? WHERE id = ? AND project_id = ?`,
            [type.trim(), title.trim(), note.trim(), uid, id]
        );

        if (!result.affectedRows) {
            return errorResponse(res, 'Update not found.', 404);
        }

        // Process new media if any
        if (req.files && req.files.length > 0) {
            const mediaValues = req.files.map(f => {
                const isVideo = f.mimetype.startsWith('video/');
                const isImage = f.mimetype.startsWith('image/');
                const mType = isImage ? 'photo' : (isVideo ? 'video' : 'attachment');
                const fileUrl = f.location || `/uploads/${f.filename}`;
                const sizeStr = (f.size / (1024 * 1024)).toFixed(2) + ' MB';
                return [uid, mType, fileUrl, f.originalname, sizeStr];
            });

            await db.query(
                `INSERT INTO project_update_media (update_id, media_type, file_url, file_name, file_size) VALUES ?`,
                [mediaValues]
            );
        }

        const [rows] = await db.query('SELECT * FROM project_updates WHERE id = ?', [uid]);
        const updatedRecord = rows[0];
        const [media] = await db.query('SELECT * FROM project_update_media WHERE update_id = ?', [uid]);
        updatedRecord.media = media;

        return successResponse(res, { data: updatedRecord }, 'Update updated.');
    } catch (err) {
        console.error('[updateUpdate]', err);
        return errorResponse(res, 'Server error updating update.');
    }
};

export const deleteUpdateMedia = async (req, res) => {
    try {
        const { id, uid, mid } = req.params;
        
        // Ensure the update belongs to the project
        const [updates] = await db.query('SELECT id FROM project_updates WHERE id = ? AND project_id = ?', [uid, id]);
        if (!updates.length) return errorResponse(res, 'Update not found for this project.', 404);

        const [result] = await db.query('DELETE FROM project_update_media WHERE id = ? AND update_id = ?', [mid, uid]);
        if (!result.affectedRows) return errorResponse(res, 'Media not found.', 404);
        return successResponse(res, {}, 'Media deleted.');
    } catch (err) {
        console.error('[deleteUpdateMedia]', err);
        return errorResponse(res, 'Server error deleting media.');
    }
};
