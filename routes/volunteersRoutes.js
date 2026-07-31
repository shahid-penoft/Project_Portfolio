import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    uploadVolunteerImage,
    getVolunteers,
    getVolunteerById,
    createVolunteer,
    updateVolunteer,
    deleteVolunteer,
} from '../controllers/volunteersController.js';
import {
    validateVolunteerPayload,
    validateVolunteerUpdatePayload,
} from '../middlewares/validateVolunteer.js';

const router = express.Router();

/** Rate limiter: max 10 volunteer registrations per 15 minutes per IP */
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

// POST /api/volunteers/upload-image - Upload volunteer profile photo
router.post('/upload-image', uploadVolunteerImage);

// GET /api/volunteers - Public volunteer directory (supports ?search=, ?status=, ?availability=, ?sector=, ?category=, ?panchayat=, ?local_body_id=, ?page=, ?limit=)
router.get('/', getVolunteers);

// GET /api/volunteers/:id - Fetch single volunteer profile
router.get('/:id', getVolunteerById);

// POST /api/volunteers - Register new volunteer (rate-limited + validated)
router.post('/', registrationLimiter, validateVolunteerPayload, createVolunteer);

// PUT /api/volunteers/:id - Update volunteer profile / status
router.put('/:id', validateVolunteerUpdatePayload, updateVolunteer);

// DELETE /api/volunteers/:id - Remove volunteer entry
router.delete('/:id', deleteVolunteer);

export default router;
