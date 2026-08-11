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

// Protect all routes with verifyToken
router.use(verifyToken);

router.get('/', getAdminUsers); // Accessible to all authenticated admins
router.post('/', requireSuperadmin, createAdminUser);
router.put('/:id', requireSuperadmin, updateAdminUser);
router.delete('/:id', requireSuperadmin, deleteAdminUser);

export default router;
