import express from 'express';
import { verifyToken, requirePermission } from '../middlewares/auth.js';
import { getRoles, getRoleById, createRole, updateRole, deleteRole } from '../controllers/rbacController.js';

const router = express.Router();

// Only superadmin or those with 'site_settings' can manage roles.
// But as per plan, we restrict this heavily. We'll use a special string or just let superadmin bypass.
// Actually, let's require 'site_settings' as the permission, since superadmin bypasses anyway.
router.use(verifyToken, requirePermission(['role_management', 'site_settings']));

router.get('/', getRoles);
router.get('/:id', getRoleById);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;
