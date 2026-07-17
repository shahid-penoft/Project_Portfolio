import pool from '../configs/db.js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logActivity as auditLog } from './teamsLogController.js';
import { sendSMSSafe } from '../services/smsService.js';
import { submissionConfirmationSMS, followUpUpdateSMS } from '../services/smsTemplates.js';
import { createNotification, broadcastNotification } from '../utils/notificationHelper.js';
import { notifyUser } from '../utils/userNotificationHelper.js';

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

const logActivity = async (suggestionId, text, adminUserId = null) => {
    await pool.query(
        'INSERT INTO suggestion_activity (suggestion_id, text, admin_user_id) VALUES (?, ?, ?)',
        [suggestionId, text, adminUserId]
    );
};

// Helper: generate reference number  S-NNN
const generateReferenceNo = async () => {
    const [[{ maxSeq }]] = await pool.query('SELECT COALESCE(MAX(CAST(SUBSTRING(reference_no, 3) AS UNSIGNED)), 0) as maxSeq FROM suggestions WHERE reference_no LIKE "S-%"');
    const seq = String(maxSeq + 1).padStart(3, '0');
    return `S-${seq}`;
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

const fetchFullSuggestion = async (id) => {
    const [[suggestion]] = await pool.query(`
        SELECT i.*,
               i.department AS department_name,
               lb.name AS local_body_name,
               lbw.ward_no,
               lbw.place_name AS ward_place_name,
               au.full_name   AS filed_by_admin_name
        FROM suggestions i
        LEFT JOIN local_bodies     lb  ON i.local_body_id     = lb.id
        LEFT JOIN local_body_wards lbw ON i.ward_id           = lbw.id
        LEFT JOIN admin_users      au  ON i.filed_by_admin_id = au.id
        WHERE i.id = ?
    `, [id]);

    if (!suggestion) return null;

    const [updates]        = await pool.query('SELECT * FROM suggestion_updates     WHERE suggestion_id = ? ORDER BY created_at ASC', [id]);
    const [allMedia]       = await pool.query('SELECT * FROM suggestion_media       WHERE suggestion_id = ? ORDER BY created_at ASC', [id]);
    const [allAttachments] = await pool.query('SELECT * FROM suggestion_attachments WHERE suggestion_id = ? ORDER BY created_at ASC', [id]);

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
    const [team] = await pool.query(`
        SELECT it.id, it.role_label, it.created_at,
               au.id as admin_user_id, au.full_name as name, au.email
        FROM suggestion_team it
        JOIN admin_users au ON it.admin_user_id = au.id
        WHERE it.suggestion_id = ?
        ORDER BY it.created_at ASC
    `, [id]);
    const [activity] = await pool.query(`
        SELECT sa.*, au.full_name as author_name 
        FROM suggestion_activity sa
        LEFT JOIN admin_users au ON sa.admin_user_id = au.id
        WHERE sa.suggestion_id = ? 
        ORDER BY sa.created_at DESC
    `, [id]);

    return { ...suggestion, updates: mappedUpdates, media, attachments, team, activity };
};

export const getSuggestions = async (req, res) => {
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
            `SELECT COUNT(*) as total FROM suggestions i ${where}`, params
        );

        const [rows] = await pool.query(`
            SELECT i.id, i.reference_no, i.title, i.category, i.priority, i.status, i.description,
                   i.complainant_name, i.phone, i.date_filed, i.created_at, i.is_deleted,
                   i.department AS department_name,
                   lb.name AS local_body_name,
                   lbw.ward_no, lbw.place_name AS ward_name
            FROM suggestions i
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
        console.error('[getSuggestions]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch suggestions.' });
    }
};

export const getSuggestionStats = async (req, res) => {
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
            FROM suggestions
        `);
        res.json({ success: true, data: stats });
    } catch (err) {
        console.error('[getSuggestionStats]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
    }
};

export const getSuggestionById = async (req, res) => {
    try {
        const suggestion = await fetchFullSuggestion(req.params.id);
        if (!suggestion) return res.status(404).json({ success: false, message: 'Suggestion not found.' });

        if (!req.isAdmin && req.constituent) {
            if (suggestion.constituent_user_id !== req.constituent.id) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        }

        res.json({ success: true, data: suggestion });
    } catch (err) {
        console.error('[getSuggestionById]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch suggestion.' });
    }
};

export const createSuggestion = async (req, res) => {
    try {
        const {
            title, category, priority, status, description, location, address, latitude, longitude, internal_note,
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
            INSERT INTO suggestions
              (reference_no, title, category, priority, status, description, location, address, latitude, longitude, internal_note,
               complainant_name, phone, alternative_phone, email,
               local_body_id, ward_id, department,
               constituent_user_id, filed_by_admin_id, date_filed)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            reference_no,
            title,
            category || 'Other',
            priority || 'Medium',
            status || 'Pending',
            description || null,
            location || null,
            address || null,
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
        await logActivity(newId, `Suggestion "${title}" filed. Reference: ${reference_no}`, req.admin?.id);
        auditLog(req, { action: 'Created', module: 'Suggestions', details: `Suggestion filed — "${title}" (${reference_no})`, resource: `suggestions/${newId}`, severity: 'info' });
        broadcastNotification({
          title: `New Suggestion ${reference_no}`,
          message: `"${title}" submitted by ${complainant_name}.`,
          type: 'message', module: 'Suggestions',
          record_id: newId, record_ref: reference_no,
          link_path: `/mlaconnect/suggestions/${newId}`,
        });

        // Fire-and-forget: SMS confirmation to complainant
        // Admin may supply a custom message via the notification drawer — prefer that if present.
        const smsBody = custom_sms_message?.trim() || submissionConfirmationSMS({
            name: complainant_name,
            referenceNo: reference_no,
            moduleLabel: 'Suggestion',
        });
        sendSMSSafe(phone, smsBody);

        const suggestion = await fetchFullSuggestion(newId);
        res.status(201).json({ success: true, message: 'Suggestion created successfully.', data: suggestion });
    } catch (err) {
        console.error('[createSuggestion]', err);
        res.status(500).json({ success: false, message: 'Failed to create suggestion.' });
    }
};

export const updateSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, category, priority, status, description, location, address, latitude, longitude, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed,
        } = req.body;

        const [result] = await pool.query(`
            UPDATE suggestions SET
              title = COALESCE(?, title),
              category = COALESCE(?, category),
              priority = COALESCE(?, priority),
              status = COALESCE(?, status),
              description = COALESCE(?, description),
              location = COALESCE(?, location),
              address = COALESCE(?, address),
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
            title, category, priority, status, description, location, address, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department, date_filed, id,
        ]);

        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Suggestion not found.' });
        await logActivity(id, `Suggestion details updated by admin.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Suggestion ID ${id} updated`, resource: `suggestions/${id}`, severity: 'success' });
        const suggestion = await fetchFullSuggestion(id);
        res.json({ success: true, message: 'Suggestion updated.', data: suggestion });
    } catch (err) {
        console.error('[updateSuggestion]', err);
        res.status(500).json({ success: false, message: 'Failed to update suggestion.' });
    }
};

export const updateSuggestionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'status is required.' });

        const [result] = await pool.query('UPDATE suggestions SET status = ? WHERE id = ?', [status, id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Suggestion not found.' });

        await logActivity(id, `Status changed to "${status}".`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Suggestion ID ${id} status changed to "${status}"`, resource: `suggestions/${id}`, severity: 'info' });
        const [sTeam] = await pool.query('SELECT admin_user_id FROM suggestion_team WHERE suggestion_id = ?', [id]);
        const [[sRec]] = await pool.query('SELECT reference_no FROM suggestions WHERE id = ?', [id]);
        sTeam.forEach(m => createNotification(m.admin_user_id, {
          title: `Status updated on Suggestion ${sRec?.reference_no || `#${id}`}`,
          message: `Status changed to "${status}".`,
          type: 'info', module: 'Suggestions',
          record_id: Number(id), record_ref: sRec?.reference_no || null,
          link_path: `/mlaconnect/suggestions/${id}`,
        }));
        // Notify the constituent who filed this suggestion
        const [[sFiler]] = await pool.query('SELECT constituent_user_id, reference_no FROM suggestions WHERE id = ?', [id]);
        if (sFiler?.constituent_user_id) {
          notifyUser(sFiler.constituent_user_id, {
            title: `Your Suggestion ${sFiler.reference_no || `#${id}`} was updated`,
            message: `Status changed to "${status}". Check your submissions for details.`,
            type: 'info', module: 'Suggestions',
            record_ref: sFiler.reference_no || null,
            link_path: `/mla-connect/submissions/${id}`,
          });
        }
        res.json({ success: true, message: `Status updated to ${status}.` });
    } catch (err) {
        console.error('[updateSuggestionStatus]', err);
        res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
};

export const trashSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'UPDATE suggestions SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND is_deleted = 0', [id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Suggestion not found or already trashed.' });
        await logActivity(id, 'Suggestion moved to trash.', req.admin?.id);
        auditLog(req, { action: 'Archived', module: 'Suggestions', details: `Suggestion ID ${id} moved to trash`, resource: `suggestions/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Suggestion moved to trash.' });
    } catch (err) {
        console.error('[trashSuggestion]', err);
        res.status(500).json({ success: false, message: 'Failed to trash suggestion.' });
    }
};

export const restoreSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'UPDATE suggestions SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND is_deleted = 1', [id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Suggestion not found in trash.' });
        await logActivity(id, 'Suggestion restored from trash.', req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Suggestion ID ${id} restored from trash`, resource: `suggestions/${id}`, severity: 'info' });
        res.json({ success: true, message: 'Suggestion restored successfully.' });
    } catch (err) {
        console.error('[restoreSuggestion]', err);
        res.status(500).json({ success: false, message: 'Failed to restore suggestion.' });
    }
};

export const deleteSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        if (force !== 'true') {
            return res.status(400).json({ success: false, message: 'Permanent deletion requires ?force=true. Use PATCH /trash to soft-delete.' });
        }

        const [media]       = await pool.query('SELECT file_url FROM suggestion_media       WHERE suggestion_id = ?', [id]);
        const [attachments] = await pool.query('SELECT file_url FROM suggestion_attachments WHERE suggestion_id = ?', [id]);
        await Promise.all([...media, ...attachments].map(r => deleteS3Object(r.file_url)));

        const [result] = await pool.query('DELETE FROM suggestions WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Suggestion not found.' });

        auditLog(req, { action: 'Deleted', module: 'Suggestions', details: `Suggestion ID ${id} permanently deleted`, resource: `suggestions/${id}`, severity: 'error' });
        res.json({ success: true, message: 'Suggestion permanently deleted.' });
    } catch (err) {
        console.error('[deleteSuggestion]', err);
        res.status(500).json({ success: false, message: 'Failed to delete suggestion.' });
    }
};

export const addSuggestionUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, title, note, notify_complainant, custom_sms_message } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'title is required.' });

        // FIX: 4 columns → 4 placeholders (was incorrectly 6)
        const [result] = await pool.query(
            'INSERT INTO suggestion_updates (suggestion_id, type, title, note) VALUES (?,?,?,?)',
            [id, type || 'Status Update', title, note || null]
        );
        const updateId = result.insertId;

        if (req.files && req.files['media'] && req.files['media'].length > 0) {
            const rows = req.files['media'].map(f => {
                const isVideo = f.mimetype.startsWith('video/') || !!f.originalname.match(/\.(mp4|mov|avi|webm|mkv)$/i);
                return [id, isVideo ? 'video' : 'photo', f.location, f.originalname, updateId];
            });
            await pool.query(
                'INSERT INTO suggestion_media (suggestion_id, media_type, file_url, caption, update_id) VALUES ?',
                [rows]
            );
        }

        if (req.files && req.files['attachments'] && req.files['attachments'].length > 0) {
            const rows = req.files['attachments'].map(f => [
                id, f.originalname, f.location, f.mimetype, Math.round(f.size / 1024), updateId
            ]);
            await pool.query(
                'INSERT INTO suggestion_attachments (suggestion_id, file_name, file_url, file_type, file_size_kb, update_id) VALUES ?',
                [rows]
            );
        }

        await logActivity(id, `Update added: "${title}"`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Added update to Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'info' });

        // Notify admin team members
        const [sUpdateTeam] = await pool.query('SELECT admin_user_id FROM suggestion_team WHERE suggestion_id = ?', [id]);
        const [[sRec2]] = await pool.query('SELECT reference_no, constituent_user_id FROM suggestions WHERE id = ?', [id]);
        sUpdateTeam.forEach(m => createNotification(m.admin_user_id, {
          title: `New update on Suggestion ${sRec2?.reference_no || `#${id}`}`,
          message: `"${title}" — a new update has been added.`,
          type: 'message', module: 'Suggestions',
          record_id: Number(id), record_ref: sRec2?.reference_no || null,
          link_path: `/mlaconnect/suggestions/${id}`,
        }));
        // Notify the constituent who filed this suggestion about the new update
        if (sRec2?.constituent_user_id) {
          notifyUser(sRec2.constituent_user_id, {
            title: `New update on your Suggestion ${sRec2.reference_no || `#${id}`}`,
            message: `"${title}" — the team has added a new update to your suggestion.`,
            type: 'message', module: 'Suggestions',
            record_ref: sRec2.reference_no || null,
            link_path: `/mla-connect/submissions/${id}`,
          });
        }

        // Fire-and-forget: SMS follow-up if admin chose to notify complainant
        if (notify_complainant === 'true' || notify_complainant === true) {
            const [[rec]] = await pool.query(
                'SELECT complainant_name, phone, department, status, reference_no FROM suggestions WHERE id = ?', [id]
            );
            if (rec?.phone) {
                const finalSms = custom_sms_message?.trim() || followUpUpdateSMS({
                    name: rec.complainant_name,
                    referenceNo: rec.reference_no,
                    status: rec.status,
                    department: rec.department,
                });
                sendSMSSafe(rec.phone, finalSms);
            }
        }

        const [[row]] = await pool.query('SELECT * FROM suggestion_updates WHERE id = ?', [updateId]);
        res.status(201).json({ success: true, data: row });
    } catch (err) {
        console.error('[addSuggestionUpdate]', err);
        res.status(500).json({ success: false, message: 'Failed to add update.' });
    }
};

export const deleteSuggestionUpdate = async (req, res) => {
    try {
        const { id, updateId } = req.params;
        const [result] = await pool.query(
            'DELETE FROM suggestion_updates WHERE id = ? AND suggestion_id = ?', [updateId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Update not found.' });
        await logActivity(id, `An update entry was removed.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Removed update from Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Update deleted.' });
    } catch (err) {
        console.error('[deleteSuggestionUpdate]', err);
        res.status(500).json({ success: false, message: 'Failed to delete update.' });
    }
};

export const uploadSuggestionMedia = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });

        const rows = req.files.map(f => {
            const isVideo = f.mimetype.startsWith('video/') || !!f.originalname.match(/\.(mp4|mov|avi|webm|mkv)$/i);
            const sizeKb = Math.round(f.size / 1024);
            return [id, isVideo ? 'video' : 'photo', f.location, f.originalname, f.originalname, sizeKb];
        });

        await pool.query(
            'INSERT INTO suggestion_media (suggestion_id, media_type, file_url, caption, file_name, file_size_kb) VALUES ?',
            [rows]
        );
        await logActivity(id, `${req.files.length} media file(s) uploaded.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Uploaded ${req.files.length} media file(s) to Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'info' });

        const [media] = await pool.query('SELECT * FROM suggestion_media WHERE suggestion_id = ? ORDER BY created_at ASC', [id]);
        res.status(201).json({ success: true, data: media });
    } catch (err) {
        console.error('[uploadSuggestionMedia]', err);
        res.status(500).json({ success: false, message: 'Failed to upload media.' });
    }
};

export const deleteSuggestionMedia = async (req, res) => {
    try {
        const { id, mediaId } = req.params;
        const [[row]] = await pool.query('SELECT file_url FROM suggestion_media WHERE id = ? AND suggestion_id = ?', [mediaId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Media not found.' });

        await deleteS3Object(row.file_url);
        await pool.query('DELETE FROM suggestion_media WHERE id = ?', [mediaId]);
        await logActivity(id, 'A media file was removed.', req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Removed media from Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Media deleted.' });
    } catch (err) {
        console.error('[deleteSuggestionMedia]', err);
        res.status(500).json({ success: false, message: 'Failed to delete media.' });
    }
};

export const uploadSuggestionAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });

        const rows = req.files.map(f => {
            const ext = f.originalname.split('.').pop()?.toLowerCase() || '';
            const sizeKb = Math.round(f.size / 1024);
            return [id, f.originalname, f.location, ext, sizeKb];
        });

        await pool.query(
            'INSERT INTO suggestion_attachments (suggestion_id, file_name, file_url, file_type, file_size_kb) VALUES ?',
            [rows]
        );
        await logActivity(id, `${req.files.length} attachment(s) uploaded.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Uploaded ${req.files.length} attachment(s) to Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'info' });

        const [attachments] = await pool.query('SELECT * FROM suggestion_attachments WHERE suggestion_id = ? ORDER BY created_at ASC', [id]);
        res.status(201).json({ success: true, data: attachments });
    } catch (err) {
        console.error('[uploadSuggestionAttachment]', err);
        res.status(500).json({ success: false, message: 'Failed to upload attachment.' });
    }
};

export const deleteSuggestionAttachment = async (req, res) => {
    try {
        const { id, attachId } = req.params;
        const [[row]] = await pool.query('SELECT file_url FROM suggestion_attachments WHERE id = ? AND suggestion_id = ?', [attachId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Attachment not found.' });

        await deleteS3Object(row.file_url);
        await pool.query('DELETE FROM suggestion_attachments WHERE id = ?', [attachId]);
        await logActivity(id, 'An attachment was removed.', req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Removed attachment from Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'warning' });
        res.json({ success: true, message: 'Attachment deleted.' });
    } catch (err) {
        console.error('[deleteSuggestionAttachment]', err);
        res.status(500).json({ success: false, message: 'Failed to delete attachment.' });
    }
};

export const addSuggestionTeamMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_user_id, role_label } = req.body;
        if (!admin_user_id) return res.status(400).json({ success: false, message: 'admin_user_id is required.' });

        const [[adminUser]] = await pool.query('SELECT id, full_name FROM admin_users WHERE id = ?', [admin_user_id]);
        if (!adminUser) return res.status(404).json({ success: false, message: 'Admin user not found.' });

        try {
            // FIX: 3 columns → 3 placeholders (was incorrectly 5)
            const [result] = await pool.query(
                'INSERT INTO suggestion_team (suggestion_id, admin_user_id, role_label) VALUES (?,?,?)',
                [id, admin_user_id, role_label || null]
            );
            await logActivity(id, `Team member "${adminUser.full_name}" added${role_label ? ` as ${role_label}` : ''}.`, req.admin?.id);
            auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Added team member "${adminUser.full_name}" to Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'info' });
            const [[sRef]] = await pool.query('SELECT reference_no FROM suggestions WHERE id = ?', [id]);
            createNotification(admin_user_id, {
              title: `You've been assigned to Suggestion ${sRef?.reference_no || `#${id}`}`,
              message: role_label ? `Role: ${role_label}` : 'You have been added to the suggestion team.',
              type: 'alert', module: 'Suggestions',
              record_id: Number(id), record_ref: sRef?.reference_no || null,
              link_path: `/mlaconnect/suggestions/${id}`,
            });
            const [[row]] = await pool.query(`
                SELECT it.id, it.role_label, it.created_at,
                       au.id as admin_user_id, au.full_name as name, au.email
                FROM suggestion_team it
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
        console.error('[addSuggestionTeamMember]', err);
        res.status(500).json({ success: false, message: 'Failed to add team member.' });
    }
};

export const removeSuggestionTeamMember = async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const [[row]] = await pool.query(`
            SELECT it.id, au.full_name
            FROM suggestion_team it JOIN admin_users au ON it.admin_user_id = au.id
            WHERE it.id = ? AND it.suggestion_id = ?
        `, [memberId, id]);
        if (!row) return res.status(404).json({ success: false, message: 'Team member not found.' });

        const [[sRemovedMember]] = await pool.query('SELECT admin_user_id FROM suggestion_team WHERE id = ?', [memberId]);
        await pool.query('DELETE FROM suggestion_team WHERE id = ?', [memberId]);
        await logActivity(id, `Team member "${row.full_name}" removed.`, req.admin?.id);
        auditLog(req, { action: 'Updated', module: 'Suggestions', details: `Removed team member "${row.full_name}" from Suggestion ID ${id}`, resource: `suggestions/${id}`, severity: 'warning' });
        if (sRemovedMember) createNotification(sRemovedMember.admin_user_id, {
          title: `Removed from Suggestion #${id}`,
          message: 'You have been removed from the suggestion team.',
          type: 'info', module: 'Suggestions', record_id: Number(id),
          link_path: `/mlaconnect/suggestions/${id}`,
        });
        res.json({ success: true, message: 'Team member removed.' });
    } catch (err) {
        console.error('[removeSuggestionTeamMember]', err);
        res.status(500).json({ success: false, message: 'Failed to remove team member.' });
    }
};

export const getSuggestionCategories = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM complaint_categories ORDER BY name ASC');
        const data = rows.map(r => ({ ...r, status: r.status || 'Active' }));
        res.json({ success: true, data });
    } catch (err) {
        console.error('[getSuggestionCategories]', err);
        res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
    }
};
