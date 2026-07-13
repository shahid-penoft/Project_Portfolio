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

const keyFromUrl = (url) => {
    try { return new URL(url).pathname.replace(/^\//, ''); } catch { return null; }
};

const deleteS3Object = async (url) => {
    const key = keyFromUrl(url);
    if (!key) return;
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
    } catch (err) {
        console.warn('[S3 delete warn]', key, err.message);
    }
};

const logActivity = async (ideaId, text, adminUserId = null) => {
    await pool.query(
        'INSERT INTO idea_activity (idea_id, text, admin_user_id) VALUES (?, ?, ?)',
        [ideaId, text, adminUserId]
    );
};

// Helper: generate reference number  I-NNN
const generateReferenceNo = async () => {
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM ideas');
    const seq = String(cnt + 1).padStart(3, '0');
    return `I-${seq}`;
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

const fetchFullIdea = async (id) => {
    const [[idea]] = await pool.query(`
        SELECT i.*,
               i.department AS department_name,
               lb.name AS local_body_name,
               lbw.ward_no,
               lbw.place_name AS ward_place_name,
               au.full_name   AS filed_by_admin_name
        FROM ideas i
        LEFT JOIN local_bodies     lb  ON i.local_body_id     = lb.id
        LEFT JOIN local_body_wards lbw ON i.ward_id           = lbw.id
        LEFT JOIN admin_users      au  ON i.filed_by_admin_id = au.id
        WHERE i.id = ?
    `, [id]);

    if (!idea) return null;

    const [updates]        = await pool.query('SELECT * FROM idea_updates     WHERE idea_id = ? ORDER BY created_at ASC', [id]);
    const [allMedia]       = await pool.query('SELECT * FROM idea_media       WHERE idea_id = ? ORDER BY created_at ASC', [id]);
    const [allAttachments] = await pool.query('SELECT * FROM idea_attachments WHERE idea_id = ? ORDER BY created_at ASC', [id]);

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
    const media       = allMedia.filter(m => !m.update_id);
    const attachments = allAttachments.filter(a => !a.update_id);
    const [team]        = await pool.query(`
        SELECT it.id, it.role_label, it.created_at,
               au.id as admin_user_id, au.full_name as name, au.email
        FROM idea_team it
        JOIN admin_users au ON it.admin_user_id = au.id
        WHERE it.idea_id = ?
        ORDER BY it.created_at ASC
    `, [id]);
    const [activity]    = await pool.query(`
        SELECT ia.*, au.full_name as author_name 
        FROM idea_activity ia
        LEFT JOIN admin_users au ON ia.admin_user_id = au.id
        WHERE ia.idea_id = ? 
        ORDER BY ia.created_at DESC
    `, [id]);

    return { ...idea, updates: mappedUpdates, media, attachments, team, activity };
};

export const getIdeas = async (req, res) => {
    try {
        const { status, category, priority, search, page = 1, limit = 20, trash } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const conditions = [];
        const params = [];

        if (trash === 'true') {
            conditions.push('i.is_deleted = 1');
        } else {
            conditions.push('i.is_deleted = 0');
        }

        if (!req.isAdmin && req.constituent) {
            conditions.push('i.constituent_user_id = ?');
            params.push(req.constituent.id);
        }

        if (status)   { conditions.push('i.status = ?');   params.push(status); }
        if (category && category !== 'All') { conditions.push('i.category = ?'); params.push(category); }
        if (priority && priority !== 'All') { conditions.push('i.priority = ?'); params.push(priority); }
        if (search) {
            conditions.push('(i.title LIKE ? OR i.complainant_name LIKE ? OR i.reference_no LIKE ?)');
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) as total FROM ideas i ${where}`, params
        );

        const [rows] = await pool.query(`
            SELECT i.id, i.reference_no, i.title, i.category, i.priority, i.status,
                   i.complainant_name, i.phone, i.date_filed, i.created_at, i.is_deleted,
                   i.department AS department_name,
                   lb.name AS local_body_name,
                   lbw.ward_no
            FROM ideas i
            LEFT JOIN local_bodies     lb  ON i.local_body_id = lb.id
            LEFT JOIN local_body_wards lbw ON i.ward_id = lbw.id
            ${where}
            ORDER BY i.created_at DESC
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
        console.error('[getIdeas]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch ideas.' });
    }
};

export const getIdeaStats = async (req, res) => {
    try {
        const [[stats]] = await pool.query(`
            SELECT
                COUNT(*)                                         AS total,
                SUM(status = 'Pending')                          AS pending,
                SUM(status = 'Under Review')                     AS underReview,
                SUM(status = 'Approved')                         AS approved,
                SUM(status = 'Rejected')                         AS rejected,
                SUM(status = 'Implemented')                      AS implemented,
                SUM(is_deleted = 1)                              AS trashed
            FROM ideas
        `);
        res.json({ success: true, data: stats });
    } catch (err) {
        console.error('[getIdeaStats]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
    }
};

export const getIdeaById = async (req, res) => {
    try {
        const idea = await fetchFullIdea(req.params.id);
        if (!idea) return res.status(404).json({ success: false, message: 'Idea not found.' });

        if (!req.isAdmin && req.constituent) {
            if (idea.constituent_user_id !== req.constituent.id) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        }

        res.json({ success: true, data: idea });
    } catch (err) {
        console.error('[getIdeaById]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch idea.' });
    }
};

export const createIdea = async (req, res) => {
    try {
        const {
            title, category, priority, status, description, location, latitude, longitude, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed,
            custom_sms_message,
        } = req.body;

        if (!title || !complainant_name || !phone) {
            return res.status(400).json({ success: false, message: 'title, complainant_name and phone are required.' });
        }

        const reference_no = await generateReferenceNo();
        const constituentId = req.constituent?.id || null;
        const adminId       = req.admin?.id       || null;

        const [result] = await pool.query(`
            INSERT INTO ideas
              (reference_no, title, category, priority, status, description, location, latitude, longitude, internal_note,
               complainant_name, phone, alternative_phone, email,
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
            complainant_name,
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
        await logActivity(newId, `Idea "${title}" filed. Reference: ${reference_no}`, req.admin?.id);
        auditLog(req, { action: 'Created', module: 'Ideas', details: `Idea filed — "${title}" (${reference_no})`, resource: `ideas/${newId}`, severity: 'info' });

        // Fire-and-forget: SMS confirmation to complainant
        // Admin may supply a custom message via the notification drawer — prefer that if present.
        const smsBody = custom_sms_message?.trim() || submissionConfirmationSMS({
            name: complainant_name,
            referenceNo: reference_no,
            moduleLabel: 'Idea',
        });
        sendSMSSafe(phone, smsBody);

        const idea = await fetchFullIdea(newId);
        res.status(201).json({ success: true, message: 'Idea created successfully.', data: idea });
    } catch (err) {
        console.error('[createIdea]', err);
        res.status(500).json({ success: false, message: 'Failed to create idea.' });
    }
};

export const updateIdea = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, category, priority, status, description, location, latitude, longitude, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed,
        } = req.body;

        const [result] = await pool.query(`
            UPDATE ideas SET
              title = COALESCE(?, title),
              category = COALESCE(?, category),
              priority = COALESCE(?, priority),
              status = COALESCE(?, status),
              description = COALESCE(?, description),
              location = COALESCE(?, location),
              internal_note = COALESCE(?, internal_note),
              complainant_name = COALESCE(?, complainant_name),
              phone = COALESCE(?, phone),
              alternative_phone = COALESCE(?, alternative_phone),
              email = COALESCE(?, email),
              local_body_id = COALESCE(?, local_body_id),
              ward_id = COALESCE(?, ward_id),
              department = COALESCE(?, department),
              date_filed = COALESCE(?, date_filed)
            WHERE id = ?
        `, [
            title, category, priority, status, description, location, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed, id,
        ]);

        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Idea not found.' });
        await logActivity(id, `Idea details updated by admin.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Idea ID ${id} updated`, resource: `ideas/${id}`, severity: 'success' });
        const idea = await fetchFullIdea(id);
        res.json({ success: true, message: 'Idea updated.', data: idea });
    } catch (err) {
        console.error('[updateIdea]', err);
        res.status(500).json({ success: false, message: 'Failed to update idea.' });
    }
};

export const updateIdeaStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'status is required.' });

        const [result] = await pool.query('UPDATE ideas SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Idea not found.' });

        await logActivity(id, `Status changed to "${status}".`, req.admin?.id);
        res.json({ success: true, message: `Status updated to ${status}.` });
    } catch (err) {
        console.error('[updateIdeaStatus]', err);
        res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
};

export const trashIdea = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'UPDATE ideas SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND is_deleted = 0', [id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Idea not found or already trashed.' });
        await logActivity(id, 'Idea moved to trash.', req.admin?.id);
        auditLog(req, { action: 'Archived', module: 'Ideas', details: `Idea ID ${id} moved to trash`, resource: `ideas/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Idea moved to trash.' });
    } catch (err) {
        console.error('[trashIdea]', err);
        res.status(500).json({ success: false, message: 'Failed to trash idea.' });
    }
};

export const restoreIdea = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'UPDATE ideas SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND is_deleted = 1', [id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Idea not found in trash.' });
        await logActivity(id, 'Idea restored from trash.', req.admin?.id);
        res.json({ success: true, message: 'Idea restored successfully.' });
    } catch (err) {
        console.error('[restoreIdea]', err);
        res.status(500).json({ success: false, message: 'Failed to restore idea.' });
    }
};

export const deleteIdea = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        if (force !== 'true') {
            return res.status(400).json({ success: false, message: 'Permanent deletion requires ?force=true. Use PATCH /trash to soft-delete.' });
        }

        const [media]       = await pool.query('SELECT file_url FROM idea_media       WHERE idea_id = ?', [id]);
        const [attachments] = await pool.query('SELECT file_url FROM idea_attachments WHERE idea_id = ?', [id]);
        await Promise.all([...media, ...attachments].map(r => deleteS3Object(r.file_url)));

        const [result] = await pool.query('DELETE FROM ideas WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Idea not found.' });

        auditLog(req, { action: 'Deleted', module: 'Ideas', details: `Idea ID ${id} permanently deleted`, resource: `ideas/${id}`, severity: 'error' });
        res.json({ success: true, message: 'Idea permanently deleted.' });
    } catch (err) {
        console.error('[deleteIdea]', err);
        res.status(500).json({ success: false, message: 'Failed to delete idea.' });
    }
};

export const addIdeaUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, title, note, notify_complainant } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'title is required.' });

        const [result] = await pool.query(
            'INSERT INTO idea_updates (idea_id, type, title, note) VALUES (?,?,?,?)',
            [id, type || 'Status Update', title, note || null]
        );
        const updateId = result.insertId;

        if (req.files && req.files['media'] && req.files['media'].length > 0) {
            const rows = req.files['media'].map(f => {
                const isVideo = f.mimetype.startsWith('video/') || !!f.originalname.match(/\.(mp4|mov|avi|webm|mkv)$/i);
                return [id, isVideo ? 'video' : 'photo', f.location, f.originalname, updateId];
            });
            await pool.query(
                'INSERT INTO idea_media (idea_id, media_type, file_url, caption, update_id) VALUES ?',
                [rows]
            );
        }

        if (req.files && req.files['attachments'] && req.files['attachments'].length > 0) {
            const rows = req.files['attachments'].map(f => [
                id, f.originalname, f.location, f.mimetype, Math.round(f.size / 1024), updateId
            ]);
            await pool.query(
                'INSERT INTO idea_attachments (idea_id, file_name, file_url, file_type, file_size_kb, update_id) VALUES ?',
                [rows]
            );
        }

        await logActivity(id, `Update added: "${title}"`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Added update to Idea ID ${id}`, resource: `ideas/${id}`, severity: 'info' });

        // Fire-and-forget: SMS follow-up if admin chose to notify complainant
        if (notify_complainant === 'true' || notify_complainant === true) {
            const [[rec]] = await pool.query(
                'SELECT complainant_name, phone, department, status, reference_no FROM ideas WHERE id = ?', [id]
            );
            if (rec?.phone) {
                sendSMSSafe(rec.phone, followUpUpdateSMS({
                    name: rec.complainant_name,
                    referenceNo: rec.reference_no,
                    status: rec.status,
                    department: rec.department,
                }));
            }
        }

        const [[row]] = await pool.query('SELECT * FROM idea_updates WHERE id = ?', [updateId]);
        res.status(201).json({ success: true, data: row });
    } catch (err) {
        console.error('[addIdeaUpdate]', err);
        res.status(500).json({ success: false, message: 'Failed to add update.' });
    }
};

export const deleteIdeaUpdate = async (req, res) => {
    try {
        const { id, updateId } = req.params;
        const [result] = await pool.query(
            'DELETE FROM idea_updates WHERE id = ? AND idea_id = ?', [updateId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Update not found.' });
        await logActivity(id, `An update entry was removed.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Removed update from Idea ID ${id}`, resource: `ideas/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Update deleted.' });
    } catch (err) {
        console.error('[deleteIdeaUpdate]', err);
        res.status(500).json({ success: false, message: 'Failed to delete update.' });
    }
};

export const uploadIdeaMedia = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });

        const rows = req.files.map(f => {
            const isVideo = f.mimetype.startsWith('video/') || !!f.originalname.match(/\.(mp4|mov|avi|webm|mkv)$/i);
            return [id, isVideo ? 'video' : 'photo', f.location, f.originalname];
        });

        await pool.query(
            'INSERT INTO idea_media (idea_id, media_type, file_url, caption) VALUES ?',
            [rows]
        );
        await logActivity(id, `${req.files.length} media file(s) uploaded.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Uploaded ${req.files.length} media file(s) to Idea ID ${id}`, resource: `ideas/${id}`, severity: 'info' });

        const [media] = await pool.query('SELECT * FROM idea_media WHERE idea_id = ? ORDER BY created_at ASC', [id]);
        res.status(201).json({ success: true, data: media });
    } catch (err) {
        console.error('[uploadIdeaMedia]', err);
        res.status(500).json({ success: false, message: 'Failed to upload media.' });
    }
};

export const deleteIdeaMedia = async (req, res) => {
    try {
        const { id, mediaId } = req.params;
        const [[row]] = await pool.query('SELECT file_url FROM idea_media WHERE id = ? AND idea_id = ?', [mediaId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Media not found.' });

        await deleteS3Object(row.file_url);
        await pool.query('DELETE FROM idea_media WHERE id = ?', [mediaId]);
        await logActivity(id, 'A media file was removed.', req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Removed media from Idea ID ${id}`, resource: `ideas/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Media deleted.' });
    } catch (err) {
        console.error('[deleteIdeaMedia]', err);
        res.status(500).json({ success: false, message: 'Failed to delete media.' });
    }
};

export const uploadIdeaAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });

        const rows = req.files.map(f => {
            const ext = f.originalname.split('.').pop()?.toLowerCase() || '';
            const sizeKb = Math.round(f.size / 1024);
            return [id, f.originalname, f.location, ext, sizeKb];
        });

        await pool.query(
            'INSERT INTO idea_attachments (idea_id, file_name, file_url, file_type, file_size_kb) VALUES ?',
            [rows]
        );
        await logActivity(id, `${req.files.length} attachment(s) uploaded.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Uploaded ${req.files.length} attachment(s) to Idea ID ${id}`, resource: `ideas/${id}`, severity: 'info' });

        const [attachments] = await pool.query('SELECT * FROM idea_attachments WHERE idea_id = ? ORDER BY created_at ASC', [id]);
        res.status(201).json({ success: true, data: attachments });
    } catch (err) {
        console.error('[uploadIdeaAttachment]', err);
        res.status(500).json({ success: false, message: 'Failed to upload attachment.' });
    }
};

export const deleteIdeaAttachment = async (req, res) => {
    try {
        const { id, attachId } = req.params;
        const [[row]] = await pool.query('SELECT file_url FROM idea_attachments WHERE id = ? AND idea_id = ?', [attachId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Attachment not found.' });

        await deleteS3Object(row.file_url);
        await pool.query('DELETE FROM idea_attachments WHERE id = ?', [attachId]);
        await logActivity(id, 'An attachment was removed.', req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Removed attachment from Idea ID ${id}`, resource: `ideas/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Attachment deleted.' });
    } catch (err) {
        console.error('[deleteIdeaAttachment]', err);
        res.status(500).json({ success: false, message: 'Failed to delete attachment.' });
    }
};

export const addIdeaTeamMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_user_id, role_label } = req.body;
        if (!admin_user_id) return res.status(400).json({ success: false, message: 'admin_user_id is required.' });

        const [[adminUser]] = await pool.query('SELECT id, full_name FROM admin_users WHERE id = ?', [admin_user_id]);
        if (!adminUser) return res.status(404).json({ success: false, message: 'Admin user not found.' });

        try {
            const [result] = await pool.query(
                'INSERT INTO idea_team (idea_id, admin_user_id, role_label) VALUES (?,?,?)',
                [id, admin_user_id, role_label || null]
            );
            await logActivity(id, `Team member "${adminUser.full_name}" added${role_label ? ` as ${role_label}` : ''}.`, req.admin?.id);
            auditLog(req, { action: 'Updated', module: 'Ideas', details: `Added team member "${adminUser.full_name}" to Idea ID ${id}`, resource: `ideas/${id}`, severity: 'info' });
            const [[row]] = await pool.query(`
                SELECT it.id, it.role_label, it.created_at,
                       au.id as admin_user_id, au.full_name as name, au.email
                FROM idea_team it
                JOIN admin_users au ON it.admin_user_id = au.id
                WHERE it.id = ?
            `, [result.insertId]);
            res.status(201).json({ success: true, data: row });
        } catch (dupErr) {
            if (dupErr.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: 'This admin is already in the team.' });
            }
            throw dupErr;
        }
    } catch (err) {
        console.error('[addIdeaTeamMember]', err);
        res.status(500).json({ success: false, message: 'Failed to add team member.' });
    }
};

export const removeIdeaTeamMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const [[row]] = await pool.query(`
            SELECT it.id, au.full_name
            FROM idea_team it JOIN admin_users au ON it.admin_user_id = au.id
            WHERE it.id = ? AND it.idea_id = ?
        `, [memberId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Team member not found.' });

        await pool.query('DELETE FROM idea_team WHERE id = ?', [memberId]);
        await logActivity(id, `Team member "${row.full_name}" removed.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Ideas', details: `Removed team member "${row.full_name}" from Idea ID ${id}`, resource: `ideas/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Team member removed.' });
    } catch (err) {
        console.error('[removeIdeaTeamMember]', err);
        res.status(500).json({ success: false, message: 'Failed to remove team member.' });
    }
};

export const getIdeaCategories = async (req, res) => {
    try {
        const cats = ['Infrastructure', 'Education', 'Healthcare', 'Environment', 'Employment', 'Welfare', 'Other'];
        res.json({ success: true, data: cats.map((name, i) => ({ id: i + 1, name, status: 'Active' })) });
    } catch (err) {
        console.error('[getIdeaCategories]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
    }
};
