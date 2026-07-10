import db from '../configs/db.js';
import { logActivity as auditLog } from './teamsLogController.js';

// Get all roles
export const getRoles = async (req, res) => {
    try {
        const [roles] = await db.query('SELECT id, name, permissions, is_system, created_at, updated_at FROM admin_roles');
        
        // Parse permissions from string to JSON array
        const parsedRoles = roles.map(role => ({
            ...role,
            permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions
        }));

        res.json({ success: true, data: parsedRoles });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, message: 'Server error fetching roles.' });
    }
};

// Get single role
export const getRoleById = async (req, res) => {
    try {
        const [roles] = await db.query('SELECT id, name, permissions, is_system FROM admin_roles WHERE id = ?', [req.params.id]);
        if (!roles.length) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }
        
        const role = roles[0];
        role.permissions = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;

        res.json({ success: true, data: role });
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ success: false, message: 'Server error fetching role.' });
    }
};

// Create a new role
export const createRole = async (req, res) => {
    const { name, permissions } = req.body;
    
    if (!name) {
        return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    try {
        const [existing] = await db.query('SELECT id FROM admin_roles WHERE LOWER(name) = ?', [name.toLowerCase()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Role with this name already exists' });
        }

        const permsString = JSON.stringify(Array.isArray(permissions) ? permissions : []);

        const [result] = await db.query(
            'INSERT INTO admin_roles (name, permissions, is_system) VALUES (?, ?, 0)',
            [name, permsString]
        );

        auditLog(req, { action: 'Permission Changed', module: 'Roles', details: `New role created: "${name}"`, resource: `settings/roles/${result.insertId}`, severity: 'info' });
        res.status(201).json({ success: true, message: 'Role created successfully', id: result.insertId });
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ success: false, message: 'Server error creating role.' });
    }
};

// Update an existing role
export const updateRole = async (req, res) => {
    const { name, permissions } = req.body;
    const roleId = req.params.id;

    try {
        const [roles] = await db.query('SELECT is_system FROM admin_roles WHERE id = ?', [roleId]);
        if (!roles.length) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        if (roles[0].is_system) {
            return res.status(403).json({ success: false, message: 'Cannot modify system roles' });
        }

        let query = 'UPDATE admin_roles SET permissions = ?';
        let params = [JSON.stringify(Array.isArray(permissions) ? permissions : [])];

        if (name) {
            // check for name conflict
            const [existing] = await db.query('SELECT id FROM admin_roles WHERE LOWER(name) = ? AND id != ?', [name.toLowerCase(), roleId]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: 'Another role with this name already exists' });
            }
            query += ', name = ?';
            params.push(name);
        }

        query += ' WHERE id = ?';
        params.push(roleId);

        await db.query(query, params);

        const roleName = name || roles[0].name;
        auditLog(req, { action: 'Permission Changed', module: 'Roles', details: `Role "${roleName}" permissions updated`, resource: `settings/roles/${roleId}`, severity: 'warning' });
        res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ success: false, message: 'Server error updating role.' });
    }
};

// Delete a role
export const deleteRole = async (req, res) => {
    const roleId = req.params.id;

    try {
        const [roles] = await db.query('SELECT is_system FROM admin_roles WHERE id = ?', [roleId]);
        if (!roles.length) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        if (roles[0].is_system) {
            return res.status(403).json({ success: false, message: 'Cannot delete system roles' });
        }

        // Check if users are using this role
        const [users] = await db.query('SELECT id FROM admin_users WHERE role_id = ?', [roleId]);
        if (users.length > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete role as it is assigned to users' });
        }

        await db.query('DELETE FROM admin_roles WHERE id = ?', [roleId]);

        auditLog(req, { action: 'Deleted', module: 'Roles', details: `Role ID ${roleId} permanently deleted`, resource: `settings/roles/${roleId}`, severity: 'error' });
        res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ success: false, message: 'Server error deleting role.' });
    }
};
