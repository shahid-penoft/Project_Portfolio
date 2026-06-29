import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../controllers/adminUsersController.js';

const router = express.Router();

// Middleware to strictly restrict to Superadmin
const requireSuperadmin = (req, res, next) => {
    if (!req.admin || req.admin.role?.toLowerCase() !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Superadmin access required' });
    }
    next();
};

// Protect all routes with verifyToken and requireSuperadmin
router.use(verifyToken, requireSuperadmin);

router.get('/', getAdminUsers);
router.post('/', createAdminUser);
router.put('/:id', updateAdminUser);
router.delete('/:id', deleteAdminUser);

export default router;
