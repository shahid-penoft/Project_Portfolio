import {
    fetchAllApplications,
    fetchApplicationById,
    insertApplication,
    updateApplicationById,
    updateApplicationStatusById,
    deleteApplicationById,
} from '../models/mlaCareModel.js';
import { uploadDocument, runMulter } from '../configs/multerS3.js';

/**
 * POST /api/mla-care/upload-document
 * Upload a medical document (image / PDF / etc.) for a care application.
 */
export const uploadCareDocument = async (req, res) => {
    try {
        await runMulter(uploadDocument, req, res);
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No document file provided.' });
        }
        const url = req.file.location || `/uploads/${req.file.filename}`;
        const name = req.file.originalname || req.file.filename;
        return res.json({
            success: true,
            data: { url, name },
            message: 'Document uploaded successfully.',
        });
    } catch (err) {
        console.error('[uploadCareDocument error]:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Document upload failed.',
        });
    }
};

/**
 * GET /api/mla-care
 * Fetch MLA Care applications with optional filters + pagination (admin).
 */
export const getApplications = async (req, res) => {
    try {
        const result = await fetchAllApplications(req.query);
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('[getApplications error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to load MLA Care applications.',
        });
    }
};

/**
 * GET /api/mla-care/:id
 * Fetch a single MLA Care application by id (admin).
 */
export const getApplicationById = async (req, res) => {
    try {
        const application = await fetchApplicationById(req.params.id);
        if (!application) {
            return res.status(404).json({ success: false, message: 'MLA Care application not found.' });
        }
        return res.json({ success: true, data: application });
    } catch (err) {
        console.error('[getApplicationById error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve MLA Care application.',
        });
    }
};

/**
 * POST /api/mla-care
 * Submit a new MLA Care application (public). Payload sanitized by validateMlaCarePayload.
 */
export const createApplication = async (req, res) => {
    try {
        const data = req.sanitizedApplication || req.body;
        const newApplication = await insertApplication(data);
        return res.status(201).json({
            success: true,
            message: 'MLA Care application submitted successfully!',
            data: newApplication,
        });
    } catch (err) {
        console.error('[createApplication error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while submitting MLA Care application. Please try again.',
        });
    }
};

/**
 * PUT /api/mla-care/:id
 * Update an existing MLA Care application (admin). Sanitized by validateMlaCareUpdatePayload.
 */
export const updateApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await fetchApplicationById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'MLA Care application not found.' });
        }
        const data = req.sanitizedApplication || req.body;
        const updated = await updateApplicationById(id, data);
        return res.json({
            success: true,
            message: 'MLA Care application updated successfully.',
            data: updated,
        });
    } catch (err) {
        console.error('[updateApplication error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update MLA Care application.',
        });
    }
};

/**
 * PATCH /api/mla-care/:id/status
 * Update only the status of a MLA Care application (admin).
 */
export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        const existing = await fetchApplicationById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'MLA Care application not found.' });
        }
        const updated = await updateApplicationStatusById(id, status);
        return res.json({
            success: true,
            message: `Application status updated to ${status}`,
            data: updated,
        });
    } catch (err) {
        console.error('[updateStatus error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update application status.',
        });
    }
};

/**
 * DELETE /api/mla-care/:id
 * Delete a MLA Care application (admin).
 */
export const deleteApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await fetchApplicationById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'MLA Care application not found.' });
        }
        await deleteApplicationById(id);
        return res.json({ success: true, message: 'MLA Care application record removed successfully.' });
    } catch (err) {
        console.error('[deleteApplication error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete MLA Care application record.',
        });
    }
};
