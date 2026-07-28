import {
    fetchActiveUrgentNeeds,
    fetchDonorsByGroup,
    insertBloodDonor,
    updateBloodDonorInDB,
    deleteBloodDonorInDB,
} from '../models/bloodDonorModel.js';
import { uploadImage, runMulter } from '../configs/multerS3.js';

/**
 * POST /api/blood-donors/upload-image
 * Upload donor profile photo image file.
 */
export const uploadDonorImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided.' });
        }
        const url = req.file.location || `/uploads/${req.file.filename}`;
        return res.json({
            success: true,
            data: { url },
            message: 'Profile photo uploaded successfully.',
        });
    } catch (err) {
        console.error('[uploadDonorImage error]:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Profile photo upload failed.',
        });
    }
};

/**
 * GET /api/blood-donors/urgent-needs
 * Fetch active urgent blood requirement alert.
 */
export const getUrgentBloodNeeds = async (req, res) => {
    try {
        const urgentNeed = await fetchActiveUrgentNeeds();

        return res.json({
            success: true,
            data: urgentNeed,
        });
    } catch (err) {
        console.error('[getUrgentBloodNeeds error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch urgent blood requirements.',
        });
    }
};

/**
 * GET /api/blood-donors?blood_group=O+
 * Fetch voluntary blood donors directory with optional blood group filter.
 */
export const getBloodDonors = async (req, res) => {
    try {
        const bloodGroup = (req.query.blood_group || req.query.group || '').trim().toUpperCase();

        const donors = await fetchDonorsByGroup(bloodGroup);

        return res.json({
            success: true,
            data: donors,
        });
    } catch (err) {
        console.error('[getBloodDonors error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve voluntary blood donor directory.',
        });
    }
};

/**
 * POST /api/blood-donors
 * Register a new voluntary blood donor.
 */
export const registerBloodDonor = async (req, res) => {
    try {
        const donorData = req.sanitizedDonor || req.body;

        const newDonor = await insertBloodDonor(donorData);

        return res.status(201).json({
            success: true,
            message: 'Thank you for registering as a voluntary blood donor!',
            data: newDonor,
        });
    } catch (err) {
        console.error('[registerBloodDonor error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred while registering blood donor. Please try again.',
        });
    }
};

/**
 * PUT /api/blood-donors/:id
 * Update an existing voluntary blood donor.
 */
export const updateBloodDonor = async (req, res) => {
    try {
        const { id } = req.params;
        const donorData = req.body;

        await updateBloodDonorInDB(id, donorData);

        return res.json({
            success: true,
            message: 'Blood donor updated successfully',
        });
    } catch (err) {
        console.error('[updateBloodDonor error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update blood donor record.',
        });
    }
};

/**
 * DELETE /api/blood-donors/:id
 * Delete a voluntary blood donor.
 */
export const deleteBloodDonor = async (req, res) => {
    try {
        const { id } = req.params;

        await deleteBloodDonorInDB(id);

        return res.json({
            success: true,
            message: 'Donor entry removed successfully',
        });
    } catch (err) {
        console.error('[deleteBloodDonor error]:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete blood donor record.',
        });
    }
};
