import pool from '../configs/db.js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

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

const logActivity = async (ideaId, text) => {
    await pool.query(
        'INSERT INTO idea_activity (idea_id, text) VALUES (?, ?)',
        [ideaId, text]
    );
};

const generateReferenceNo = async () => {
    const year = new Date().getFullYear();
    const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM ideas WHERE YEAR(created_at) = ?', [year]
    );
    const seq = String(cnt + 1).padStart(4, '0');
    return `IDEA-${year}-${seq}`;
};

const fetchFullIdea = async (id) => {
    const [[idea]] = await pool.query(`
        SELECT i.*,
               d.name  AS department_name,
               lb.name AS local_body_name,
               lbw.ward_no,
               lbw.place_name AS ward_place_name,
               au.full_name   AS filed_by_admin_name
        FROM ideas i
        LEFT JOIN departments      d   ON i.department_id     = d.id
        LEFT JOIN local_bodies     lb  ON i.local_body_id     = lb.id
        LEFT JOIN local_body_wards lbw ON i.ward_id           = lbw.id
        LEFT JOIN admin_users      au  ON i.filed_by_admin_id = au.id
        WHERE i.id = ?
    `, [id]);

    if (!idea) return null;

    const [updates]     = await pool.query('SELECT * FROM idea_updates     WHERE idea_id = ? ORDER BY created_at ASC', [id]);
    const [media]       = await pool.query('SELECT * FROM idea_media        WHERE idea_id = ? ORDER BY created_at ASC', [id]);
    const [attachments] = await pool.query('SELECT * FROM idea_attachments  WHERE idea_id = ? ORDER BY created_at ASC', [id]);
    const [team]        = await pool.query(`
        SELECT it.id, it.role_label, it.created_at,
               au.id as admin_user_id, au.full_name as name, au.email
        FROM idea_team it
        JOIN admin_users au ON it.admin_user_id = au.id
        WHERE it.idea_id = ?
        ORDER BY it.created_at ASC
    `, [id]);
    const [activity]    = await pool.query('SELECT * FROM idea_activity     WHERE idea_id = ? ORDER BY created_at DESC', [id]);

    return { ...idea, updates, media, attachments, team, activity };
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
                   d.name AS department_name,
                   lb.name AS local_body_name,
                   lbw.ward_no
            FROM ideas i
            LEFT JOIN departments      d   ON i.department_id = d.id
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
            title, category, priority, status, description, location, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department_id, date_filed,
        } = req.body;

        if (!title || !complainant_name || !phone) {
            return res.status(400).json({ success: false, message: 'title, complainant_name and phone are required.' });
        }

        const reference_no = await generateReferenceNo();
        const constituentId = req.constituent?.id || null;
        const adminId       = req.admin?.id       || null;

        const [result] = await pool.query(`
            INSERT INTO ideas
              (reference_no, title, category, priority, status, description, location, internal_note,
               complainant_name, phone, alternative_phone, email,
               local_body_id, ward_id, department_id,
               constituent_user_id, filed_by_admin_id, date_filed)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
            reference_no,
            title,
            category || 'Other',
            priority || 'Medium',
            status || 'Pending',
            description || null,
            location || null,
            internal_note || null,
            complainant_name,
            phone,
            alternative_phone || null,
            email || null,
            local_body_id || null,
            ward_id || null,
            department_id || null,
            constituentId,
            adminId,
            date_filed || new Date().toISOString().split('T')[0],
        ]);

        const newId = result.insertId;
        await logActivity(newId, `Idea "${title}" filed. Reference: ${reference_no}`);

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
            title, category, priority, status, description, location, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department_id, date_filed,
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
              department_id = COALESCE(?, department_id),
              date_filed = COALESCE(?, date_filed)
            WHERE id = ?
        `, [
            title, category, priority, status, description, location, internal_note,
            complainant_name, phone, alternative_phone, email,
            local_body_id, ward_id, department_id, date_filed, id,
        ]);

        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Idea not found.' });
        await logActivity(id, `Idea details updated by admin.`);
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

        await logActivity(id, `Status changed to "${status}".`);
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
        await logActivity(id, 'Idea moved to trash.');
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
        await logActivity(id, 'Idea restored from trash.');
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

        res.json({ success: true, message: 'Idea permanently deleted.' });
    } catch (err) {
        console.error('[deleteIdea]', err);
        res.status(500).json({ success: false, message: 'Failed to delete idea.' });
    }
};

export const addIdeaUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, title, note } = req.body;
        if (!title) return res.status(400).json({ success: false, message: 'title is required.' });

        const [result] = await pool.query(
            'INSERT INTO idea_updates (idea_id, type, title, note) VALUES (?,?,?,?)',
            [id, type || 'Status Update', title, note || null]
        );
        await logActivity(id, `Update added: "${title}"`);
        const [[row]] = await pool.query('SELECT * FROM idea_updates WHERE id = ?', [result.insertId]);
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
        await logActivity(id, `An update entry was removed.`);
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
            const isVideo = f.mimetype.startsWith('video/');
            return [id, isVideo ? 'video' : 'photo', f.location, f.originalname];
        });

        await pool.query(
            'INSERT INTO idea_media (idea_id, media_type, file_url, caption) VALUES ?',
            [rows]
        );
        await logActivity(id, `${req.files.length} media file(s) uploaded.`);

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
        await logActivity(id, 'A media file was removed.');
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
        await logActivity(id, `${req.files.length} attachment(s) uploaded.`);

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
        await logActivity(id, 'An attachment was removed.');
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
            await logActivity(id, `Team member "${adminUser.full_name}" added${role_label ? ` as ${role_label}` : ''}.`);
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
        await logActivity(id, `Team member "${row.full_name}" removed.`);
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
