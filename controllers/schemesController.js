import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadJobDocuments } from '../configs/multerS3.js'; // Reusing job documents config since S3 destination was chosen

// ─── HELPER: Auto-expire schemes ──────────────────────────────
const updateExpiredSchemes = async () => {
    try {
        await pool.query("UPDATE welfare_schemes SET status = 'expired' WHERE deadline < CURDATE() AND status = 'active'");
    } catch (e) {
        console.error('Failed to auto-expire schemes:', e);
    }
};

// ─── HELPER: Format Scheme Data ───────────────────────────────
const formatScheme = (row) => ({
    ...row,
    id: row.scheme_ref, // UI expects string ID 'SCH-001'
    numeric_id: row.id, // Internal ID
    userBenefits: typeof row.user_benefits === 'string' ? JSON.parse(row.user_benefits || '[]') : row.user_benefits || [],
    eligibilities: typeof row.eligibilities === 'string' ? JSON.parse(row.eligibilities || '[]') : row.eligibilities || [],
    supportingDocuments: typeof row.supporting_documents === 'string' ? JSON.parse(row.supporting_documents || '[]') : row.supporting_documents || [],
    features: typeof row.features === 'string' ? JSON.parse(row.features || '[]') : row.features || [],
    deadline: row.deadline ? new Date(row.deadline).toISOString().split('T')[0] : null,
});

// ─────────────────────────────────────────────────────────────
//  GET /api/schemes/all
//  Public — paginated, search, filter
// ─────────────────────────────────────────────────────────────
export const getSchemes = async (req, res) => {
    await updateExpiredSchemes();

    const { search, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;

    try {
        let where = 'WHERE 1=1';
        const params = [];

        if (status) {
            where += ' AND status = ?';
            params.push(status);
        }

        if (search) {
            where += ' AND title LIKE ?';
            params.push(`%${search}%`);
        }

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM welfare_schemes ${where}`, params);

        const [rows] = await pool.query(
            `SELECT * FROM welfare_schemes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const formattedRows = rows.map(formatScheme);

        return successResponse(res, {
            data: formattedRows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }, 'Schemes fetched successfully.');
    } catch (err) {
        console.error('[getSchemes]', err);
        return errorResponse(res, 'Failed to fetch schemes.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/schemes/:id
//  Public
// ─────────────────────────────────────────────────────────────
export const getSchemeById = async (req, res) => {
    const { id } = req.params; // Expects scheme_ref like SCH-001
    await updateExpiredSchemes();

    try {
        const query = isNaN(id)
            ? 'SELECT * FROM welfare_schemes WHERE scheme_ref = ?'
            : 'SELECT * FROM welfare_schemes WHERE id = ?';

        const [[scheme]] = await pool.query(query, [id]);

        if (!scheme) return errorResponse(res, 'Scheme not found.', 404);

        return successResponse(res, { data: formatScheme(scheme) }, 'Scheme fetched successfully.');
    } catch (err) {
        console.error('[getSchemeById]', err);
        return errorResponse(res, 'Failed to fetch scheme.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/schemes
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const createScheme = async (req, res) => {
    const { title, description, deadline, status, userBenefits, eligibilities, supportingDocuments, features } = req.body;

    if (!title) {
        return errorResponse(res, 'Title is required.', 400);
    }

    try {
        const [[{ maxId }]] = await pool.query('SELECT MAX(id) as maxId FROM welfare_schemes');
        const nextId = (maxId || 0) + 1;
        const schemeRef = `SCH-${nextId.toString().padStart(3, '0')}`; // E.g., SCH-001

        const [result] = await pool.query(
            `INSERT INTO welfare_schemes (scheme_ref, title, description, deadline, status, user_benefits, eligibilities, supporting_documents, features)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                schemeRef, title, description || null, deadline || null, status || 'active',
                JSON.stringify(userBenefits || []),
                JSON.stringify(eligibilities || []),
                JSON.stringify(supportingDocuments || []),
                JSON.stringify(features || [])
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM welfare_schemes WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: formatScheme(row) }, 'Scheme created successfully.', 201);
    } catch (err) {
        console.error('[createScheme]', err);
        return errorResponse(res, 'Failed to create scheme.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PUT /api/schemes/:id
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const updateScheme = async (req, res) => {
    const { id } = req.params; // scheme_ref or id
    const { title, description, deadline, status, userBenefits, eligibilities, supportingDocuments, features } = req.body;

    if (!title) {
        return errorResponse(res, 'Title is required.', 400);
    }

    try {
        const query = isNaN(id) ? 'SELECT id FROM welfare_schemes WHERE scheme_ref = ?' : 'SELECT id FROM welfare_schemes WHERE id = ?';
        const [[existing]] = await pool.query(query, [id]);
        
        if (!existing) return errorResponse(res, 'Scheme not found.', 404);

        await pool.query(
            `UPDATE welfare_schemes SET title = ?, description = ?, deadline = ?, status = ?, user_benefits = ?, eligibilities = ?, supporting_documents = ?, features = ?
             WHERE id = ?`,
            [
                title, description || null, deadline || null, status || 'active',
                JSON.stringify(userBenefits || []),
                JSON.stringify(eligibilities || []),
                JSON.stringify(supportingDocuments || []),
                JSON.stringify(features || []),
                existing.id
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM welfare_schemes WHERE id = ?', [existing.id]);
        return successResponse(res, { data: formatScheme(row) }, 'Scheme updated successfully.');
    } catch (err) {
        console.error('[updateScheme]', err);
        return errorResponse(res, 'Failed to update scheme.');
    }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/schemes/:id
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const deleteScheme = async (req, res) => {
    const { id } = req.params; // scheme_ref or numeric
    try {
        const query = isNaN(id) ? 'DELETE FROM welfare_schemes WHERE scheme_ref = ?' : 'DELETE FROM welfare_schemes WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        if (!result.affectedRows) return errorResponse(res, 'Scheme not found.', 404);
        return successResponse(res, {}, 'Scheme deleted successfully.');
    } catch (err) {
        console.error('[deleteScheme]', err);
        return errorResponse(res, 'Failed to delete scheme.');
    }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/schemes/:id/apply
//  Constituent Auth (multipart)
// ─────────────────────────────────────────────────────────────
export const submitSchemeApplication = async (req, res) => {
    try {
        await runMulter(uploadJobDocuments, req, res);

        const { id } = req.params; // scheme_ref
        const query = isNaN(id) ? 'SELECT id FROM welfare_schemes WHERE scheme_ref = ?' : 'SELECT id FROM welfare_schemes WHERE id = ?';
        const [[scheme]] = await pool.query(query, [id]);

        if (!scheme) {
            return errorResponse(res, 'Scheme not found.', 404);
        }

        const { applicantName, phone, aadhaar, ward } = req.body;

        if (!applicantName || !phone || !aadhaar) {
            return errorResponse(res, 'Name, phone, and Aadhaar are required.', 400);
        }

        let documents = [];
        if (req.files && req.files.length > 0) {
            documents = req.files.map(file => ({
                name: file.originalname,
                url: file.location || file.path
            }));
        }

        const refId = `APP-${Math.floor(1000 + Math.random() * 9000)}`;

        await pool.query(
            `INSERT INTO scheme_applications (reference_id, scheme_id, constituent_id, applicant_name, phone, aadhaar, ward, documents)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                refId, scheme.id, req.constituent.id, applicantName, phone, aadhaar, ward || null,
                JSON.stringify(documents)
            ]
        );

        return successResponse(res, { reference_id: refId }, 'Application submitted successfully.', 201);
    } catch (err) {
        console.error('[submitSchemeApplication]', err);
        return errorResponse(res, 'Failed to submit application.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/schemes/my-applications
//  Constituent Auth
// ─────────────────────────────────────────────────────────────
export const getMySchemeApplications = async (req, res) => {
    try {
        const [applications] = await pool.query(
            `SELECT sa.*, s.title AS scheme_title, s.scheme_ref
             FROM scheme_applications sa
             JOIN welfare_schemes s ON sa.scheme_id = s.id
             WHERE sa.constituent_id = ?
             ORDER BY sa.submitted_at DESC`,
            [req.constituent.id]
        );

        const formatted = applications.map(app => ({
            ...app,
            documents: typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || []
        }));

        return successResponse(res, { data: formatted }, 'Applications fetched successfully.');
    } catch (err) {
        console.error('[getMySchemeApplications]', err);
        return errorResponse(res, 'Failed to fetch your applications.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/schemes/applications
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const getAllSchemeApplications = async (req, res) => {
    try {
        const { status, scheme_id } = req.query;
        let where = 'WHERE 1=1';
        const params = [];

        if (status) {
            where += ' AND sa.status = ?';
            params.push(status);
        }

        if (scheme_id) {
            where += ' AND sa.scheme_id = ?';
            params.push(scheme_id);
        }

        const [applications] = await pool.query(
            `SELECT sa.*, s.title AS scheme_title, s.scheme_ref
             FROM scheme_applications sa
             JOIN welfare_schemes s ON sa.scheme_id = s.id
             ${where}
             ORDER BY sa.submitted_at DESC`,
            params
        );

        const formatted = applications.map(app => ({
            ...app,
            documents: typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || []
        }));

        return successResponse(res, { data: formatted }, 'Applications fetched successfully.');
    } catch (err) {
        console.error('[getAllSchemeApplications]', err);
        return errorResponse(res, 'Failed to fetch applications.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/schemes/:id/applications
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const getSchemeApplicationsByScheme = async (req, res) => {
    const { id } = req.params; // scheme_ref or numeric id
    try {
        let schemeIdQuery = isNaN(id) ? '(SELECT id FROM welfare_schemes WHERE scheme_ref = ?)' : '?';

        const [applications] = await pool.query(
            `SELECT sa.*, s.title AS scheme_title, s.scheme_ref
             FROM scheme_applications sa
             JOIN welfare_schemes s ON sa.scheme_id = s.id
             WHERE sa.scheme_id = ${schemeIdQuery}
             ORDER BY sa.submitted_at DESC`,
            [id]
        );

        const formatted = applications.map(app => ({
            ...app,
            documents: typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || []
        }));

        return successResponse(res, { data: formatted }, 'Applications fetched successfully.');
    } catch (err) {
        console.error('[getSchemeApplicationsByScheme]', err);
        return errorResponse(res, 'Failed to fetch applications.');
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/schemes/applications/:appId
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const getSchemeApplicationById = async (req, res) => {
    try {
        const { appId } = req.params;
        const [applications] = await pool.query(
            `SELECT sa.*, s.title AS scheme_title, s.scheme_ref
             FROM scheme_applications sa
             JOIN welfare_schemes s ON sa.scheme_id = s.id
             WHERE sa.id = ?`,
            [appId]
        );

        if (applications.length === 0) {
            return errorResponse(res, 'Application not found.', 404);
        }

        const app = applications[0];
        app.documents = typeof app.documents === 'string' ? JSON.parse(app.documents || '[]') : app.documents || [];

        return successResponse(res, { data: app }, 'Application fetched successfully.');
    } catch (err) {
        console.error('[getSchemeApplicationById]', err);
        return errorResponse(res, 'Failed to fetch application.');
    }
};

// ─────────────────────────────────────────────────────────────
//  PATCH /api/schemes/applications/:appId/status
//  Admin Auth
// ─────────────────────────────────────────────────────────────
export const updateSchemeApplicationStatus = async (req, res) => {
    try {
        const { appId } = req.params;
        const { status, adminNotes } = req.body;

        if (!status) {
            return errorResponse(res, 'Status is required.', 400);
        }

        const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return errorResponse(res, 'Invalid status.', 400);
        }

        let updateQuery = 'UPDATE scheme_applications SET status = ?';
        const queryParams = [status];

        if (adminNotes !== undefined) {
            updateQuery += ', admin_notes = ?';
            queryParams.push(adminNotes);
        }

        updateQuery += ' WHERE id = ?';
        queryParams.push(appId);

        const [result] = await pool.query(updateQuery, queryParams);

        if (result.affectedRows === 0) {
            return errorResponse(res, 'Application not found.', 404);
        }

        return successResponse(res, {}, 'Application status updated successfully.');
    } catch (err) {
        console.error('[updateSchemeApplicationStatus]', err);
        return errorResponse(res, 'Failed to update application status.');
    }
};
