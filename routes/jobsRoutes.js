import express from 'express';
import { getJobs, getJobByIdOrSlug, createJob, updateJob, deleteJob, submitApplication, getJobApplications, getMyApplications, getAllApplications, getApplicationById, updateApplicationStatus } from '../controllers/jobsController.js';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { verifyConstituentToken } from '../middlewares/constituentAuth.js';

const router = express.Router();

// Public routes
router.get('/', getJobs);

// Constituent routes (must be before parameterized routes)
router.get('/my-applications', verifyConstituentToken, getMyApplications);
router.post('/:id/apply', verifyConstituentToken, submitApplication);

// Admin routes (must be before parameterized routes)
router.get('/all-applications', verifyToken, getAllApplications);
router.get('/applications/:id', verifyToken, getApplicationById);
router.patch('/applications/:id/status', verifyToken, updateApplicationStatus);

// Public parameterized routes
router.get('/:idOrSlug', getJobByIdOrSlug);

// Admin routes with params
router.post('/', verifyToken, createJob);
router.put('/:id', verifyToken, updateJob);
router.delete('/:id', verifyToken, deleteJob);
router.get('/:id/applications', verifyToken, getJobApplications);

export default router;
