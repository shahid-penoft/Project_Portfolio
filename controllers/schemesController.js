import pool from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { runMulter, uploadSchemeApplicationDocs, uploadSchemeAttachments } from '../configs/multerS3.js';
import { logActivity } from './teamsLogController.js';
import { broadcastNotification } from '../utils/notificationHelper.js';

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
    schemeStatus: row.scheme_status,
    category: row.category,
    domain: row.domain,
    publish_status: row.status,
    features: typeof row.features === 'string' ? JSON.parse(row.features || '[]') : row.features || [],
    eligibilities: typeof row.eligibilities === 'string' ? JSON.parse(row.eligibilities || '[]') : row.eligibilities || [],
    attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments || '[]') : row.attachments || [],
    showActionButton: !!row.show_action_button,
    actionButtonLabel: row.action_button_label || '',
    actionButtonUrl: row.action_button_url || '',
    showOnWebsite: row.status === 'Published' || !!row.show_on_website,
    coverImage: row.cover_image || '',
    deadline: row.deadline ? new Date(row.deadline).toISOString().split('T')[0] : null,
    createdBy: row.created_by_name || 'Rajesh Kumar (ADM-001)',
    updatedBy: row.updated_by_name || row.created_by_name || 'Rajesh Kumar (ADM-001)',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

        const [logs] = await pool.query(
            `SELECT 
                l.id,
                l.action,
                l.details AS text,
                l.created_at,
                COALESCE(u.full_name, 'System') AS author_name
             FROM admin_activity_logs l
             LEFT JOIN admin_users u ON l.admin_user_id = u.id
             WHERE l.module = 'Welfare Schemes' AND (l.resource = ? OR l.resource = ?)
             ORDER BY l.created_at DESC`,
            [scheme.scheme_ref, String(scheme.id)]
        );

        const formattedLogs = logs.map(l => ({
            id: l.id,
            author_name: l.author_name,
            text: l.text,
            time: l.created_at,
            created_at: l.created_at,
        }));

        const formattedData = {
            ...formatScheme(scheme),
            activity: formattedLogs,
        };

        return successResponse(res, { data: formattedData }, 'Scheme fetched successfully.');
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
    try {
        await runMulter(uploadSchemeAttachments, req, res);

        let { 
            title, schemeStatus, category, domain, deadline, status, 
            description, features, showActionButton, actionButtonLabel, 
            actionButtonUrl, eligibilities, showOnWebsite 
        } = req.body;

        if (!title) {
            return errorResponse(res, 'Title is required.', 400);
        }

        const parseJSON = (str) => {
            try { return JSON.parse(str); } catch { return []; }
        };

        features = typeof features === 'string' ? parseJSON(features) : (features || []);
        eligibilities = typeof eligibilities === 'string' ? parseJSON(eligibilities) : (eligibilities || []);
        
        const isShowActionButton = showActionButton === 'true' || showActionButton === true;
        const isShowOnWebsite = status === 'Published';

        const coverImageFile = req.files && req.files['coverImage'] ? req.files['coverImage'][0] : null;
        const coverImageUrl = coverImageFile ? (coverImageFile.location || coverImageFile.path) : null;

        let attachments = [];
        if (req.files && req.files['files'] && req.files['files'].length > 0) {
            attachments = req.files['files'].map(f => {
                const formattedSize = typeof f.size === 'number'
                    ? (f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`)
                    : (f.size || '—');
                return {
                    name: f.originalname,
                    url: f.location || f.path,
                    type: f.mimetype,
                    size: formattedSize
                };
            });
        }

        const adminInfo = req.admin?.full_name
            ? `${req.admin.full_name} (${req.admin.id ? `ADM-${String(req.admin.id).padStart(3, '0')}` : 'ADM-001'})`
            : 'Rajesh Kumar (ADM-001)';

        const [[{ maxId }]] = await pool.query('SELECT MAX(id) as maxId FROM welfare_schemes');
        const nextId = (maxId || 0) + 1;
        const schemeRef = `SCH-${nextId.toString().padStart(3, '0')}`;

        const [result] = await pool.query(
            `INSERT INTO welfare_schemes 
             (scheme_ref, title, scheme_status, category, domain, deadline, status, cover_image, description, features, show_action_button, action_button_label, action_button_url, eligibilities, attachments, show_on_website, created_by_name, updated_by_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                schemeRef, title, schemeStatus || 'Active', category || null, domain || null, 
                deadline || null, status || 'Draft', coverImageUrl, description || null,
                JSON.stringify(features), isShowActionButton, actionButtonLabel || null, 
                actionButtonUrl || null, JSON.stringify(eligibilities),
                JSON.stringify(attachments), isShowOnWebsite, adminInfo, adminInfo
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM welfare_schemes WHERE id = ?', [result.insertId]);

        await logActivity(req, {
            action: 'Created',
            module: 'Welfare Schemes',
            details: `Created new scheme: ${title}`,
            resource: schemeRef
        });

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
    try {
        await runMulter(uploadSchemeAttachments, req, res);

        const { id } = req.params; // scheme_ref or id
        let { 
            title, schemeStatus, category, domain, deadline, status, 
            description, features, showActionButton, actionButtonLabel, 
            actionButtonUrl, eligibilities, showOnWebsite, existingAttachments 
        } = req.body;

        if (!title) {
            return errorResponse(res, 'Title is required.', 400);
        }

        const query = isNaN(id) ? 'SELECT id, attachments, cover_image FROM welfare_schemes WHERE scheme_ref = ?' : 'SELECT id, attachments, cover_image FROM welfare_schemes WHERE id = ?';
        const [[existing]] = await pool.query(query, [id]);
        
        if (!existing) return errorResponse(res, 'Scheme not found.', 404);

        const parseJSON = (str) => {
            try { return JSON.parse(str); } catch { return []; }
        };

        features = typeof features === 'string' ? parseJSON(features) : (features || []);
        eligibilities = typeof eligibilities === 'string' ? parseJSON(eligibilities) : (eligibilities || []);
        existingAttachments = typeof existingAttachments === 'string' ? parseJSON(existingAttachments) : (existingAttachments || []);
        
        const isShowActionButton = showActionButton === 'true' || showActionButton === true;
        const newStatus = status !== undefined ? status : existing.status;
        const isShowOnWebsite = newStatus === 'Published';

        const coverImageFile = req.files && req.files['coverImage'] ? req.files['coverImage'][0] : null;
        let coverImageUrl = existing.cover_image;
        if (coverImageFile) {
            coverImageUrl = coverImageFile.location || coverImageFile.path;
        }

        let attachments = [...existingAttachments];
        if (req.files && req.files['files'] && req.files['files'].length > 0) {
            const newAttachments = req.files['files'].map(f => {
                const formattedSize = typeof f.size === 'number'
                    ? (f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`)
                    : (f.size || '—');
                return {
                    name: f.originalname,
                    url: f.location || f.path,
                    type: f.mimetype,
                    size: formattedSize
                };
            });
            attachments = [...attachments, ...newAttachments];
        }

        const adminInfo = req.admin?.full_name
            ? `${req.admin.full_name} (${req.admin.id ? `ADM-${String(req.admin.id).padStart(3, '0')}` : 'ADM-001'})`
            : 'Rajesh Kumar (ADM-001)';

        await pool.query(
            `UPDATE welfare_schemes SET 
                title = ?, scheme_status = ?, category = ?, domain = ?, deadline = ?, status = ?, 
                cover_image = ?, description = ?, features = ?, show_action_button = ?, 
                action_button_label = ?, action_button_url = ?, eligibilities = ?, attachments = ?, show_on_website = ?,
                updated_by_name = ?
             WHERE id = ?`,
            [
                title, schemeStatus || 'Active', category || null, domain || null, 
                deadline || null, status || 'Draft', coverImageUrl, description || null,
                JSON.stringify(features), isShowActionButton, actionButtonLabel || null, 
                actionButtonUrl || null, JSON.stringify(eligibilities),
                JSON.stringify(attachments), isShowOnWebsite, adminInfo,
                existing.id
            ]
        );

        const [[row]] = await pool.query('SELECT * FROM welfare_schemes WHERE id = ?', [existing.id]);
        
        await logActivity(req, {
            action: 'Updated',
            module: 'Welfare Schemes',
            details: `Updated scheme: ${title}`,
            resource: row.scheme_ref
        });
        
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
        
        await logActivity(req, {
            action: 'Deleted',
            module: 'Welfare Schemes',
            details: `Deleted scheme: ${id}`,
            resource: String(id)
        });

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
        await runMulter(uploadSchemeApplicationDocs, req, res);

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

        // Notify all admins about the new scheme application
        const [[schemeRow]] = await pool.query('SELECT title, scheme_ref FROM welfare_schemes WHERE id = ?', [scheme.id]);
        broadcastNotification({
          title: `New Scheme Application — ${schemeRow?.title || ''}`,
          message: `${applicantName} applied for ${schemeRow?.title || 'a welfare scheme'} (Ref: ${refId}).`,
          type: 'scheme', module: 'Schemes',
          record_ref: refId, link_path: `/mlaconnect/schemes/applications`,
        });
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

        await logActivity(req, {
            action: 'Updated',
            module: 'Welfare Schemes',
            details: `Updated application status to ${status}`,
            resource: String(appId)
        });

        return successResponse(res, {}, 'Application status updated successfully.');
    } catch (err) {
        console.error('[updateSchemeApplicationStatus]', err);
        return errorResponse(res, 'Failed to update application status.');
    }
};
