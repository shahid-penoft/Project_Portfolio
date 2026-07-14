import pool from '../configs/db.js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logActivity as auditLog } from './teamsLogController.js';
import { sendSMSSafe } from '../services/smsService.js';
import { submissionConfirmationSMS, followUpUpdateSMS } from '../services/smsTemplates.js';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const s3Bucket = process.env.AWS_S3_BUCKET || 'my-portfolio-bucket';

// Helper: extract S3 key from a full URL
const keyFromUrl = (url) => {
    try { return new URL(url).pathname.replace(/^\//, ''); } catch { return null; }
};

// Helper: delete an S3 object (non-fatal)
const deleteS3Object = async (url) => {
    const key = keyFromUrl(url);
    if (!key) return;
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
    } catch (err) {
        console.warn('[S3 delete warn]', key, err.message);
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/issues/categories
// ─────────────────────────────────────────────────────────────
export const getCategories = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM complaint_categories ORDER BY created_at ASC');
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[getCategories]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/issues/categories
// ─────────────────────────────────────────────────────────────
export const createCategory = async (req, res) => {
    try {
        const { name, status } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'name is required.' });

        const [result] = await pool.query(
            'INSERT INTO complaint_categories (name, status) VALUES (?, ?)',
            [name, status || 'Active']
        );
        const [[newCategory]] = await pool.query('SELECT * FROM complaint_categories WHERE id = ?', [result.insertId]);
        res.status(201).json({ success: true, data: newCategory });
    } catch (err) {
        console.error('[createCategory]', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Category name already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to create category.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/issues/categories/:id
// ─────────────────────────────────────────────────────────────
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, status } = req.body;

        const [result] = await pool.query(
            'UPDATE complaint_categories SET name = COALESCE(?, name), status = COALESCE(?, status) WHERE id = ?',
            [name, status, id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Category not found.' });
        const [[updated]] = await pool.query('SELECT * FROM complaint_categories WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('[updateCategory]', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Category name already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to update category.' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/issues/categories/:id
// ─────────────────────────────────────────────────────────────
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM complaint_categories WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Category not found.' });
        res.json({ success: true, message: 'Category deleted successfully.' });
    } catch (err) {
        console.error('[deleteCategory]', err);
        res.status(500).json({ success: false, message: 'Failed to delete category.' });
    }
};

// Helper: log an activity entry
const logActivity = async (issueId, text, adminUserId = null) => {
    await pool.query(
        'INSERT INTO issue_activity (issue_id, text, admin_user_id) VALUES (?, ?, ?)',
        [issueId, text, adminUserId]
    );
};

// Helper: generate reference number  P-NNN
const generateReferenceNo = async () => {
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM issues');
    const seq = String(cnt + 1).padStart(3, '0');
    return `P-${seq}`;
};

export const getNextId = async (req, res) => {
    try {
        const nextId = await generateReferenceNo();
        res.json({ success: true, data: nextId });
    } catch (err) {
        console.error('[getNextId]', err);
        res.status(500).json({ success: false, message: 'Failed to generate next ID.' });
    }
};

// Helper: fetch full issue with all sub-resources
const fetchFullIssue = async (id) => {
    const [[issue]] = await pool.query(`
        SELECT c.*,
               c.department AS department_name,
               lb.name AS local_body_name,
               lbw.ward_no,
               lbw.place_name AS ward_place_name,
               au.full_name   AS filed_by_admin_name
        FROM issues c
        LEFT JOIN local_bodies     lb  ON c.local_body_id     = lb.id
        LEFT JOIN local_body_wards lbw ON c.ward_id           = lbw.id
        LEFT JOIN admin_users      au  ON c.filed_by_admin_id = au.id
        WHERE c.id = ?
    `, [id]);

    if (!issue) return null;

    const [updates]        = await pool.query('SELECT * FROM issue_updates     WHERE issue_id = ? ORDER BY created_at ASC', [id]);
    const [allMedia]       = await pool.query('SELECT * FROM issue_media       WHERE issue_id = ? ORDER BY created_at ASC', [id]);
    const [allAttachments] = await pool.query('SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY created_at ASC', [id]);

    const mappedUpdates = updates.map(u => ({
        ...u,
        gallery: allMedia
            .filter(m => m.update_id === u.id)
            .map(m => ({
                id:   m.id,
                url:  m.file_url,
                type: m.media_type,
                name: m.caption || m.file_url.split('/').pop(),
            })),
        attachments: allAttachments
            .filter(a => a.update_id === u.id)
            .map(a => ({
                id:   a.id,
                name: a.file_name,
                size: a.file_size_kb ? `${(a.file_size_kb / 1024).toFixed(1)} MB` : 'Unknown',
                type: a.file_type,
                url:  a.file_url,
            })),
    }));
    const media       = allMedia;
    const attachments = allAttachments;
    const [team]        = await pool.query(`
        SELECT ct.id, ct.role_label, ct.created_at,
               au.id as admin_user_id, au.full_name as name, au.email
        FROM issue_team ct
        JOIN admin_users au ON ct.admin_user_id = au.id
        WHERE ct.issue_id = ?
        ORDER BY ct.created_at ASC
    `, [id]);
    const [activity]    = await pool.query(`
        SELECT ca.*, au.full_name as author_name 
        FROM issue_activity ca
        LEFT JOIN admin_users au ON ca.admin_user_id = au.id
        WHERE ca.issue_id = ? 
        ORDER BY ca.created_at DESC
    `, [id]);

    return { ...issue, updates: mappedUpdates, media, attachments, team, activity };
};

// ─────────────────────────────────────────────────────────────
// GET /api/issues
// Query: status, category, priority, search, page, limit, trash
// ─────────────────────────────────────────────────────────────
export const getIssues = async (req, res) => {
    try {
        console.log("Updated getIssues executing...");
        const { status, category, priority, search, page = 1, limit = 20, trash } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const conditions = [];
        const params = [];

        // Trash vs live
        if (trash === 'true') {
            conditions.push('c.is_deleted = 1');
        } else {
            conditions.push('c.is_deleted = 0');
        }

        // Constituent scoping — only see own issues
        if (!req.isAdmin && req.constituent) {
            conditions.push('c.constituent_user_id = ?');
            params.push(req.constituent.id);
        }

        if (status)   { conditions.push('c.status = ?');   params.push(status); }
        if (category) { conditions.push('c.category = ?'); params.push(category); }
        if (priority) { conditions.push('c.priority = ?'); params.push(priority); }
        if (search) {
            conditions.push('(c.title LIKE ? OR c.submitter_name LIKE ? OR c.reference_no LIKE ?)');
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) as total FROM issues c ${where}`, params
        );

        const [rows] = await pool.query(`
            SELECT c.id, c.reference_no, c.title, c.category, c.priority, c.status, c.description,
                   c.submitter_name, c.phone, c.date_filed, c.created_at, c.is_deleted,
                   c.department AS department_name,
                   lb.name AS local_body_name,
                   lbw.ward_no, lbw.place_name AS ward_name
            FROM issues c
            LEFT JOIN local_bodies     lb  ON c.local_body_id = lb.id
            LEFT JOIN local_body_wards lbw ON c.ward_id = lbw.id
            ${where}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

        res.json({
            success: true,
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err) {
        console.error('[getIssues]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch issues.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/issues/stats  (admin only)
// ─────────────────────────────────────────────────────────────
export const getIssueStats = async (req, res) => {
    try {
        const [[stats]] = await pool.query(`
            SELECT
                COUNT(*)                                         AS total,
                SUM(status = 'Draft')                            AS draft,
                SUM(status = 'Pending')                          AS pending,
                SUM(status = 'Under Process')                    AS underProcess,
                SUM(status = 'Not Attended')                     AS notAttended,
                SUM(status = 'Resolved')                         AS resolved,
                SUM(status = 'Escalated')                        AS escalated,
                SUM(is_deleted = 1)                              AS trashed
            FROM issues
        `);
        res.json({ success: true, data: stats });
    } catch (err) {
        console.error('[getIssueStats]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/issues/:id
// ─────────────────────────────────────────────────────────────
export const getIssueById = async (req, res) => {
    try {
        const issue = await fetchFullIssue(req.params.id);
        if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

        // Constituent can only view their own
        if (!req.isAdmin && req.constituent) {
            if (issue.constituent_user_id !== req.constituent.id) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        }

        res.json({ success: true, data: issue });
    } catch (err) {
        console.error('[getIssueById]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch issue.' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/issues
// ─────────────────────────────────────────────────────────────
export const createIssue = async (req, res) => {
    try {
        const {
            title, category, priority, status, description, location, latitude, longitude, internal_note,
            submitter_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed,
            custom_sms_message,
        } = req.body;

        if (!title || !submitter_name || !phone) {
            return res.status(400).json({ success: false, message: 'title, submitter_name and phone are required.' });
        }

        const reference_no = await generateReferenceNo();

        const constituentId = req.constituent?.id || null;
        const adminId       = req.admin?.id       || null;

        const [result] = await pool.query(`
            INSERT INTO issues
              (reference_no, title, category, priority, status, description, location, latitude, longitude, internal_note,
               submitter_name, phone, alternative_phone, email,
               local_body_id, ward_id, department,
               constituent_user_id, filed_by_admin_id, date_filed)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            reference_no,
            title,
            category || 'Other',
            priority || 'Medium',
            status || 'Pending',
            description || null,
            location || null,
            latitude || null,
            longitude || null,
            internal_note || null,
            submitter_name,
            phone,
            alternative_phone || null,
            email || null,
            local_body_id || null,
            ward_id || null,
            department || null,
            constituentId,
            adminId,
            date_filed || new Date().toISOString().split('T')[0],
        ]);

        const newId = result.insertId;
        await logActivity(newId, `Issue "${title}" filed. Reference: ${reference_no}`, req.admin?.id);
        auditLog(req, { action: 'Created', module: 'Issues', details: `Issue filed — "${title}" (${reference_no})`, resource: `issues/${newId}`, severity: 'info' });

        // Fire-and-forget: SMS confirmation to submitter
        // Admin may supply a custom message via the notification drawer — prefer that if present.
        const smsBody = custom_sms_message?.trim() || submissionConfirmationSMS({
            name: submitter_name,
            referenceNo: reference_no,
            moduleLabel: 'Issue',
        });
        sendSMSSafe(phone, smsBody);

        const issue = await fetchFullIssue(newId);
        res.status(201).json({ success: true, message: 'Issue created successfully.', data: issue });
    } catch (err) {
        console.error('[createIssue]', err);
        res.status(500).json({ success: false, message: 'Failed to create issue.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/issues/:id  (admin only)
// ─────────────────────────────────────────────────────────────
export const updateIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, category, priority, status, description, location, latitude, longitude, internal_note,
            submitter_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed,
        } = req.body;

        const [result] = await pool.query(`
            UPDATE issues SET
              title = COALESCE(?, title),
              category = COALESCE(?, category),
              priority = COALESCE(?, priority),
              status = COALESCE(?, status),
              description = COALESCE(?, description),
              location = COALESCE(?, location),
              latitude = COALESCE(?, latitude),
              longitude = COALESCE(?, longitude),
              internal_note = COALESCE(?, internal_note),
              submitter_name = COALESCE(?, submitter_name),
              phone = COALESCE(?, phone),
              alternative_phone = COALESCE(?, alternative_phone),
              email = COALESCE(?, email),
              local_body_id = COALESCE(?, local_body_id),
              ward_id = COALESCE(?, ward_id),
              department = COALESCE(?, department),
              date_filed = COALESCE(?, date_filed)
            WHERE id = ?
        `, [
            title, category, priority, status, description, location, latitude, longitude, internal_note,
            submitter_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed, id,
        ]);

        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Issue not found.' });
        await logActivity(id, `Issue details updated by admin.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Issue ID ${id} details updated`, resource: `issues/${id}`, severity: 'success' });
        const issue = await fetchFullIssue(id);
        res.json({ success: true, message: 'Issue updated.', data: issue });
    } catch (err) {
        console.error('[updateIssue]', err);
        res.status(500).json({ success: false, message: 'Failed to update issue.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/issues/:id/status  (admin only)
// ─────────────────────────────────────────────────────────────
export const updateIssueStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'status is required.' });

        const [result] = await pool.query('UPDATE issues SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Issue not found.' });

        await logActivity(id, `Status changed to "${status}".`, req.admin?.id);
        res.json({ success: true, message: `Status updated to ${status}.` });
    } catch (err) {
        console.error('[updateIssueStatus]', err);
        res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/issues/:id/trash  (admin only — soft delete)
// ─────────────────────────────────────────────────────────────
export const trashIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'UPDATE issues SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND is_deleted = 0', [id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Issue not found or already trashed.' });
        await logActivity(id, 'Issue moved to trash.', req.admin?.id);
        auditLog(req, { action: 'Archived', module: 'Issues', details: `Issue ID ${id} moved to trash`, resource: `issues/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Issue moved to trash.' });
    } catch (err) {
        console.error('[trashIssue]', err);
        res.status(500).json({ success: false, message: 'Failed to trash issue.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/issues/:id/restore  (admin only)
// ─────────────────────────────────────────────────────────────
export const restoreIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'UPDATE issues SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND is_deleted = 1', [id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Issue not found in trash.' });
        await logActivity(id, 'Issue restored from trash.', req.admin?.id);
        res.json({ success: true, message: 'Issue restored successfully.' });
    } catch (err) {
        console.error('[restoreIssue]', err);
        res.status(500).json({ success: false, message: 'Failed to restore issue.' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/issues/:id  (admin only — permanent delete, requires ?force=true)
// ─────────────────────────────────────────────────────────────
export const deleteIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        if (force !== 'true') {
            return res.status(400).json({ success: false, message: 'Permanent deletion requires ?force=true. Use PATCH /trash to soft-delete.' });
        }

        // Delete all S3 files first
        const [media]       = await pool.query('SELECT file_url FROM issue_media       WHERE issue_id = ?', [id]);
        const [attachments] = await pool.query('SELECT file_url FROM issue_attachments WHERE issue_id = ?', [id]);
        await Promise.all([...media, ...attachments].map(r => deleteS3Object(r.file_url)));

        const [result] = await pool.query('DELETE FROM issues WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Issue not found.' });

        auditLog(req, { action: 'Deleted', module: 'Issues', details: `Issue ID ${id} permanently deleted`, resource: `issues/${id}`, severity: 'error' });
        res.json({ success: true, message: 'Issue permanently deleted.' });
    } catch (err) {
        console.error('[deleteIssue]', err);
        res.status(500).json({ success: false, message: 'Failed to delete issue.' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/issues/:id/updates  (admin only)
// ─────────────────────────────────────────────────────────────
export const addIssueUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, title, note, notify_complainant, custom_sms_message } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'title is required.' });

        const [result] = await pool.query(
            'INSERT INTO issue_updates (issue_id, type, title, note) VALUES (?,?,?,?)',
            [id, type || 'Status Update', title, note || null]
        );
        const updateId = result.insertId;

        if (req.files && req.files['media'] && req.files['media'].length > 0) {
            const rows = req.files['media'].map(f => {
                const isVideo = f.mimetype.startsWith('video/') || !!f.originalname.match(/\.(mp4|mov|avi|webm|mkv)$/i);
                return [id, isVideo ? 'video' : 'photo', f.location, f.originalname, updateId];
            });
            await pool.query(
                'INSERT INTO issue_media (issue_id, media_type, file_url, caption, update_id) VALUES ?',
                [rows]
            );
        }

        if (req.files && req.files['attachments'] && req.files['attachments'].length > 0) {
            const rows = req.files['attachments'].map(f => [
                id, f.originalname, f.location, f.mimetype, Math.round(f.size / 1024), updateId
            ]);
            await pool.query(
                'INSERT INTO issue_attachments (issue_id, file_name, file_url, file_type, file_size_kb, update_id) VALUES ?',
                [rows]
            );
        }

        await logActivity(id, `Update added: "${title}"`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Added update to Issue ID ${id}`, resource: `issues/${id}`, severity: 'info' });

        // Fire-and-forget: SMS follow-up if admin chose to notify submitter
        if (notify_complainant === 'true' || notify_complainant === true) {
            const [[rec]] = await pool.query(
                'SELECT submitter_name, phone, department, status, reference_no FROM issues WHERE id = ?', [id]
            );
            if (rec?.phone) {
                const finalSms = custom_sms_message?.trim() || followUpUpdateSMS({
                    name: rec.submitter_name,
                    referenceNo: rec.reference_no,
                    status: rec.status,
                    department: rec.department,
                });
                sendSMSSafe(rec.phone, finalSms);
            }
        }

        const [[row]] = await pool.query('SELECT * FROM issue_updates WHERE id = ?', [updateId]);
        res.status(201).json({ success: true, data: row });
    } catch (err) {
        console.error('[addIssueUpdate]', err);
        res.status(500).json({ success: false, message: 'Failed to add update.' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/issues/:id/updates/:updateId  (admin only)
// ─────────────────────────────────────────────────────────────
export const deleteIssueUpdate = async (req, res) => {
    try {
        const { id, updateId } = req.params;
        const [result] = await pool.query(
            'DELETE FROM issue_updates WHERE id = ? AND issue_id = ?', [updateId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Update not found.' });
        await logActivity(id, `An update entry was removed.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Removed update from Issue ID ${id}`, resource: `issues/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Update deleted.' });
    } catch (err) {
        console.error('[deleteIssueUpdate]', err);
        res.status(500).json({ success: false, message: 'Failed to delete update.' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/issues/:id/media  (admin or owner constituent)
// Multer processes files before this handler runs.
// ─────────────────────────────────────────────────────────────
export const uploadIssueMedia = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });

        const rows = req.files.map(f => {
            const isVideo = f.mimetype.startsWith('video/') || !!f.originalname.match(/\.(mp4|mov|avi|webm|mkv)$/i);
            return [id, isVideo ? 'video' : 'photo', f.location, f.originalname];
        });

        await pool.query(
            'INSERT INTO issue_media (issue_id, media_type, file_url, caption) VALUES ?',
            [rows]
        );
        await logActivity(id, `${req.files.length} media file(s) uploaded.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Uploaded ${req.files.length} media file(s) to Issue ID ${id}`, resource: `issues/${id}`, severity: 'info' });

        const [media] = await pool.query('SELECT * FROM issue_media WHERE issue_id = ? ORDER BY created_at ASC', [id]);
        res.status(201).json({ success: true, data: media });
    } catch (err) {
        console.error('[uploadIssueMedia]', err);
        res.status(500).json({ success: false, message: 'Failed to upload media.' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/issues/:id/media/:mediaId  (admin only)
// ─────────────────────────────────────────────────────────────
export const deleteIssueMedia = async (req, res) => {
    try {
        const { id, mediaId } = req.params;
        const [[row]] = await pool.query('SELECT file_url FROM issue_media WHERE id = ? AND issue_id = ?', [mediaId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Media not found.' });

        await deleteS3Object(row.file_url);
        await pool.query('DELETE FROM issue_media WHERE id = ?', [mediaId]);
        await logActivity(id, 'A media file was removed.', req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Removed media from Issue ID ${id}`, resource: `issues/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Media deleted.' });
    } catch (err) {
        console.error('[deleteIssueMedia]', err);
        res.status(500).json({ success: false, message: 'Failed to delete media.' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/issues/:id/attachments  (admin or owner)
// ─────────────────────────────────────────────────────────────
export const uploadIssueAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });

        const rows = req.files.map(f => {
            const ext = f.originalname.split('.').pop()?.toLowerCase() || '';
            const sizeKb = Math.round(f.size / 1024);
            return [id, f.originalname, f.location, ext, sizeKb];
        });

        await pool.query(
            'INSERT INTO issue_attachments (issue_id, file_name, file_url, file_type, file_size_kb) VALUES ?',
            [rows]
        );
        await logActivity(id, `${req.files.length} attachment(s) uploaded.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Uploaded ${req.files.length} attachment(s) to Issue ID ${id}`, resource: `issues/${id}`, severity: 'info' });

        const [attachments] = await pool.query('SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY created_at ASC', [id]);
        res.status(201).json({ success: true, data: attachments });
    } catch (err) {
        console.error('[uploadIssueAttachment]', err);
        res.status(500).json({ success: false, message: 'Failed to upload attachment.' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/issues/:id/attachments/:attachId  (admin only)
// ─────────────────────────────────────────────────────────────
export const deleteIssueAttachment = async (req, res) => {
    try {
        const { id, attachId } = req.params;
        const [[row]] = await pool.query('SELECT file_url FROM issue_attachments WHERE id = ? AND issue_id = ?', [attachId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Attachment not found.' });

        await deleteS3Object(row.file_url);
        await pool.query('DELETE FROM issue_attachments WHERE id = ?', [attachId]);
        await logActivity(id, 'An attachment was removed.', req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Removed attachment from Issue ID ${id}`, resource: `issues/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Attachment deleted.' });
    } catch (err) {
        console.error('[deleteIssueAttachment]', err);
        res.status(500).json({ success: false, message: 'Failed to delete attachment.' });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/issues/:id/team  (admin only)
// ─────────────────────────────────────────────────────────────
export const addIssueTeamMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_user_id, role_label } = req.body;
        if (!admin_user_id) return res.status(400).json({ success: false, message: 'admin_user_id is required.' });

        // Verify admin user exists
        const [[adminUser]] = await pool.query('SELECT id, full_name FROM admin_users WHERE id = ?', [admin_user_id]);
        if (!adminUser) return res.status(404).json({ success: false, message: 'Admin user not found.' });

        try {
            const [result] = await pool.query(
                'INSERT INTO issue_team (issue_id, admin_user_id, role_label) VALUES (?,?,?)',
                [id, admin_user_id, role_label || null]
            );
            await logActivity(id, `Team member "${adminUser.full_name}" added${role_label ? ` as ${role_label}` : ''}.`, req.admin?.id);
            auditLog(req, { action: 'Updated', module: 'Issues', details: `Added team member "${adminUser.full_name}" to Issue ID ${id}`, resource: `issues/${id}`, severity: 'info' });
            const [[row]] = await pool.query(`
                SELECT ct.id, ct.role_label, ct.created_at,
                       au.id as admin_user_id, au.full_name as name, au.email
                FROM issue_team ct
                JOIN admin_users au ON ct.admin_user_id = au.id
                WHERE ct.id = ?
            `, [result.insertId]);
            res.status(201).json({ success: true, data: row });
        } catch (dupErr) {
            if (dupErr.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'This admin is already in the team.' });
            }
            throw dupErr;
        }
    } catch (err) {
        console.error('[addIssueTeamMember]', err);
        res.status(500).json({ success: false, message: 'Failed to add team member.' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/issues/:id/team/:memberId  (admin only)
// ─────────────────────────────────────────────────────────────
export const removeIssueTeamMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const [[row]] = await pool.query(`
            SELECT ct.id, au.full_name
            FROM issue_team ct JOIN admin_users au ON ct.admin_user_id = au.id
            WHERE ct.id = ? AND ct.issue_id = ?
        `, [memberId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Team member not found.' });

        await pool.query('DELETE FROM issue_team WHERE id = ?', [memberId]);
        await logActivity(id, `Team member "${row.full_name}" removed.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Issues', details: `Removed team member "${row.full_name}" from Issue ID ${id}`, resource: `issues/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Team member removed.' });
    } catch (err) {
        console.error('[removeIssueTeamMember]', err);
        res.status(500).json({ success: false, message: 'Failed to remove team member.' });
    }
};
