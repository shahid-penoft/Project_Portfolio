import {
    fetchAllVolunteers,
    fetchVolunteerById,
    insertVolunteer,
    updateVolunteerById,
    deleteVolunteerById,
} from '../models/volunteerModel.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';

/**
 * POST /api/volunteers/upload-image
 * Upload volunteer profile photo.
 */
export const uploadVolunteerImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided.' });
        }
        const url = req.file.location || `/uploads/${req.file.filename}`;
        return res.json({
            success: true,
            data: { url },
            message: 'Volunteer profile photo uploaded successfully.',
        });
    } catch (err) {
        console.error('[uploadVolunteerImage error]:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Profile photo upload failed.',
        });
    }
};

/**
 * GET /api/volunteers
 * Public volunteer directory with optional filters + pagination.
 */
export const getVolunteers = async (req, res) => {
    try {
        const result = await fetchAllVolunteers(req.query);
        return res.json({ success: true, ...result });
    } catch (err) {
        console.error('[getVolunteers error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve volunteers directory.',
        });
    }
};

/**
 * GET /api/volunteers/:id
 * Fetch a single volunteer by id.
 */
export const getVolunteerById = async (req, res) => {
    try {
        const volunteer = await fetchVolunteerById(req.params.id);
        if (!volunteer) {
            return res.status(404).json({ success: false, message: 'Volunteer not found.' });
        }
        return res.json({ success: true, data: volunteer });
    } catch (err) {
        console.error('[getVolunteerById error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve volunteer.',
        });
    }
};

/**
 * POST /api/volunteers
 * Register a new volunteer. Payload sanitized by validateVolunteerPayload middleware.
 */
export const createVolunteer = async (req, res) => {
    try {
        const data = req.sanitizedVolunteer || req.body;
        const newVolunteer = await insertVolunteer(data);
        return res.status(201).json({
            success: true,
            message: 'Volunteer registered successfully!',
            data: newVolunteer,
        });
    } catch (err) {
        console.error('[createVolunteer error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while registering volunteer. Please try again.',
        });
    }
};

/**
 * PUT /api/volunteers/:id
 * Update an existing volunteer (full or partial). Sanitized by validateVolunteerUpdatePayload.
 */
export const updateVolunteer = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await fetchVolunteerById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Volunteer not found.' });
        }
        const data = req.sanitizedVolunteer || req.body;
        const updated = await updateVolunteerById(id, data);
        return res.json({
            success: true,
            message: 'Volunteer updated successfully.',
            data: updated,
        });
    } catch (err) {
        console.error('[updateVolunteer error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update volunteer record.',
        });
    }
};

/**
 * DELETE /api/volunteers/:id
 * Remove a volunteer entry.
 */
export const deleteVolunteer = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await fetchVolunteerById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Volunteer not found.' });
        }
        await deleteVolunteerById(id);
        return res.json({ success: true, message: 'Volunteer entry removed successfully.' });
    } catch (err) {
        console.error('[deleteVolunteer error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete volunteer record.',
        });
    }
};
