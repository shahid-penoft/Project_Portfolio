import pool from '../configs/db.js';

export const getDepartments = async (req, res) => {
    try {
        const [departments] = await pool.query('SELECT * FROM departments ORDER BY name ASC');
        res.status(200).json({ success: true, data: departments });
    } catch (err) {
        console.error("Error fetching departments:", err);
        res.status(500).json({ success: false, message: "Error fetching departments" });
    }
};

export const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const [departments] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
        if (departments.length === 0) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        res.status(200).json({ success: true, data: departments[0] });
    } catch (err) {
        console.error("Error fetching department:", err);
        res.status(500).json({ success: false, message: "Error fetching department" });
    }
};

export const createDepartment = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const [result] = await pool.query(
            'INSERT INTO departments (name, description) VALUES (?, ?)',
            [name, description || null]
        );

        res.status(201).json({ 
            success: true, 
            message: 'Department created successfully',
            data: { id: result.insertId, name, description }
        });
    } catch (err) {
        console.error("Error creating department:", err);
        res.status(500).json({ success: false, message: "Error creating department" });
    }
};

export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const [result] = await pool.query(
            'UPDATE departments SET name = ?, description = ? WHERE id = ?',
            [name, description || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        res.status(200).json({ success: true, message: 'Department updated successfully' });
    } catch (err) {
        console.error("Error updating department:", err);
        res.status(500).json({ success: false, message: "Error updating department" });
    }
};

export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        // Check for associated projects if not forced
        if (force !== 'true') {
            const [projects] = await pool.query('SELECT COUNT(*) as count FROM projects WHERE department_id = ?', [id]);
            if (projects[0].count > 0) {
                return res.status(409).json({
                    success: false,
                    message: `This department is assigned to ${projects[0].count} project(s).`,
                    projectCount: projects[0].count
                });
            }
        }

        const [result] = await pool.query('DELETE FROM departments WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        res.status(200).json({ success: true, message: 'Department deleted successfully' });
    } catch (err) {
        console.error("Error deleting department:", err);
        res.status(500).json({ success: false, message: "Error deleting department" });
    }
};
