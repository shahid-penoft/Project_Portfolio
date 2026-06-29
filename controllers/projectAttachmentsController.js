import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadDocument } from '../configs/multerS3.js';

export const getAttachments = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM project_attachments WHERE project_id = ? ORDER BY created_at DESC', [id]);
        return successResponse(res, { data: rows }, 'Attachments fetched.');
    } catch (err) {
        console.error('[getAttachments]', err);
        return errorResponse(res, 'Server error fetching attachments.');
    }
};

export const addAttachment = async (req, res) => {
    try {
        await runMulter(uploadDocument, req, res);
        const { id } = req.params;
        const name = req.body.name || (req.file ? req.file.originalname : 'Document');

        if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

        const uploaded_by = req.user?.id || null;
        const fileUrl = req.file.location || `/uploads/${req.file.filename}`;
        const fileSize = (req.file.size / (1024 * 1024)).toFixed(2) + ' MB';
        const fileType = req.file.mimetype;

        const [result] = await db.query(
            `INSERT INTO project_attachments (project_id, name, file_url, file_size, file_type, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, fileUrl, fileSize, fileType, uploaded_by]
        );

        const [rows] = await db.query('SELECT * FROM project_attachments WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Attachment added.', 201);
    } catch (err) {
        console.error('[addAttachment]', err);
        return errorResponse(res, 'Server error adding attachment.');
    }
};

export const deleteAttachment = async (req, res) => {
    try {
        const { id, aid } = req.params;
        const [result] = await db.query('DELETE FROM project_attachments WHERE id = ? AND project_id = ?', [aid, id]);
        if (!result.affectedRows) return errorResponse(res, 'Attachment not found.', 404);
        return successResponse(res, {}, 'Attachment deleted.');
    } catch (err) {
        console.error('[deleteAttachment]', err);
        return errorResponse(res, 'Server error deleting attachment.');
    }
};
