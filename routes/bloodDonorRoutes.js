import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    getUrgentBloodNeeds,
    getBloodDonors,
    registerBloodDonor,
    updateBloodDonor,
    deleteBloodDonor,
    uploadDonorImage,
} from '../controllers/bloodDonorController.js';
import { validateBloodDonorPayload } from '../middlewares/validateBloodDonor.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

/** Rate limiter: Max 10 donor registrations per 15 minutes per IP */
const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many registration requests from this IP. Please wait 15 minutes before trying again.',
    },
});

// POST /api/blood-donors/upload-image - Upload donor profile photo
router.post('/upload-image', uploadDonorImage);

// GET /api/blood-donors/urgent-needs - Fetch active emergency blood alert
router.get('/urgent-needs', getUrgentBloodNeeds);

// GET /api/blood-donors - Fetch donor directory with optional ?blood_group= filter
router.get('/', getBloodDonors);

// POST /api/blood-donors - Register new voluntary blood donor
router.post('/', registrationLimiter, validateBloodDonorPayload, registerBloodDonor);

// PUT /api/blood-donors/:id - Update blood donor details / verification / status (admin only)
router.put('/:id', verifyToken, updateBloodDonor);

// DELETE /api/blood-donors/:id - Remove blood donor entry (admin only)
router.delete('/:id', verifyToken, deleteBloodDonor);

export default router;
