import pool from '../configs/db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { uploadInformationCenterFiles } from '../configs/multerS3.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── S3 Config ────────────────────────────────────────────────
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});
const s3Bucket = process.env.AWS_S3_BUCKET || 'my-portfolio-bucket';

// Helper: delete a file (S3 or local) safely
const deleteMediaFile = async (url) => {
    if (!url) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            const key = new URL(url).pathname.replace(/^\//, '');
            if (key) {
                await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
            }
        } catch (err) {
            console.warn('[InformationCenter] S3 delete warning:', err.message);
        }
    } else if (url.startsWith('/uploads/')) {
        try {
            const localPath = path.join(__dirname, '..', url);
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        } catch (err) {
            console.warn('[InformationCenter] Local delete warning:', err.message);
        }
    }
};

// ─── Exported multer middleware ────────────────────────────────
export const uploadInfoCenter = uploadInformationCenterFiles;

// ─── Helpers ───────────────────────────────────────────────────
const safeJSON = (val, fallback = null) => {
    if (!val) return fallback;
    if (typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch { return fallback; }
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
        return `${datePart} at ${h % 12 || 12}:${m} ${h >= 12 ? 'pm' : 'am'}`;
    } catch { return String(dateStr); }
};

const maskMediaUrl = (url) => {
    if (!url) return '';
    const mediaBase = (process.env.MEDIA_BASE_URL || 'https://assets.shibutheckumpuram.com').replace(/\/+$/, '');
    if (typeof url === 'string' && url.includes('.amazonaws.com')) {
        return url.replace(/^https?:\/\/[^/]*\.amazonaws\.com/i, mediaBase);
    }
    return url;
};

const buildPostResponse = (row, attachments = []) => ({
    id:               row.id,
    title:            row.title,
    category:         row.category,
    domains:          safeJSON(row.domains, []),
    status:           row.status,
    web:              row.status === 'Published' || Boolean(row.web),
    rich_content:     row.rich_content || '',
    description:      row.rich_content || '',
    tags:             row.tags_count || 0,
    tagsList:         safeJSON(row.tags_list, []),
    thumbnail_url:    maskMediaUrl(row.thumbnail_url || ''),
    actionButton:     row.action_button_label
                        ? { label: row.action_button_label, url: maskMediaUrl(row.action_button_url || ''), external: Boolean(row.action_button_external) }
                        : null,
    attachments:      attachments.map(a => ({
        id:        a.id,
        name:      a.name,
        size:      a.size,
        type:      a.mime_type,
        url:       maskMediaUrl(a.url),
    })),
    createdBy:        row.created_by_name  || null,
    updatedBy:        row.updated_by_name  || null,
    createdAt:        row.created_at       || null,
    updatedAt:        row.updated_at       || null,
    createdAtDisplay: formatDateTime(row.created_at),
    updatedAtDisplay: formatDateTime(row.updated_at),
});

const getAttachments = async (postId) => {
    const [rows] = await pool.query(
        'SELECT id, name, size, mime_type, url FROM information_post_attachments WHERE post_id = ? ORDER BY id ASC',
        [postId]
    );
    return rows;
};

// ─── CONTROLLERS ───────────────────────────────────────────────

/**
 * GET /api/information-center
 * Query: page, limit, status, category (comma-sep), search, sort
 */
export const getAll = async (req, res) => {
    try {
        const page     = Math.max(1, parseInt(req.query.page)  || 1);
        const limit    = Math.min(100, parseInt(req.query.limit) || 10);
        const offset   = (page - 1) * limit;
        const { status, category, search, sort } = req.query;

        let where  = 'WHERE 1=1';
        const params = [];

        if (status && status !== 'All') {
            where += ' AND p.status = ?';
            params.push(status);
        }

        if (category) {
            const cats = category.split(',').map(c => c.trim()).filter(Boolean);
            if (cats.length > 0) {
                const conds = cats.map(() => 'JSON_CONTAINS(p.domains, ?)').join(' OR ');
                where += ` AND (${conds})`;
                params.push(...cats.map(c => JSON.stringify(c)));
            }
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            where += ' AND (p.title LIKE ? OR p.category LIKE ? OR JSON_SEARCH(p.tags_list, "one", ?) IS NOT NULL)';
            params.push(term, term, `%${search.trim()}%`);
        }

        const sortMap = {
            newest:     'p.updated_at DESC',
            oldest:     'p.updated_at ASC',
            title_asc:  'p.title ASC',
            title_desc: 'p.title DESC',
        };
        const orderBy = sortMap[sort] || 'p.updated_at DESC';

        const countParams = [...params];
        const [countRows] = await pool.query(
            `SELECT COUNT(*) as total FROM information_posts p ${where}`,
            countParams
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT * FROM information_posts p ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Tab counts (always across ALL posts)
        const [tabRows] = await pool.query(
            `SELECT status, COUNT(*) as cnt FROM information_posts GROUP BY status`
        );
        const counts = { All: 0, Published: 0, Draft: 0, Scheduled: 0 };
        let allTotal = 0;
        for (const r of tabRows) {
            counts[r.status] = r.cnt;
            allTotal += r.cnt;
        }
        counts.All = allTotal;

        const data = rows.map(r => buildPostResponse(r));

        res.json({
            success: true,
            data,
            meta: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                limit,
                counts,
            },
        });
    } catch (err) {
        console.error('[InformationCenter] getAll error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch information posts.' });
    }
};

/**
 * GET /api/information-center/:id
 */
export const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM information_posts WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post not found.' });

        const attachments = await getAttachments(rows[0].id);
        res.json({ success: true, data: buildPostResponse(rows[0], attachments) });
    } catch (err) {
        console.error('[InformationCenter] getById error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch post.' });
    }
};

/**
 * POST /api/information-center
 * multipart/form-data
 */
export const create = async (req, res) => {
    try {
        const {
            title, status = 'Draft', web = '0',
            domains, tagsList,
            showActionButton = 'false', ctaLabel = '', ctaUrl = '',
            coverImageUrl = '',
        } = req.body;

        // Validation
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required.' });
        }
        const validStatuses = ['Draft', 'Scheduled', 'Published'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
        }

        const domainsArr  = safeJSON(domains,  []);
        const tagsArr     = safeJSON(tagsList,  []);
        const showCTA     = showActionButton === 'true' || showActionButton === true;
        const webFlag     = status === 'Published' ? 1 : 0;
        const category    = domainsArr[0] || 'Other';
        const adminName   = req.admin?.full_name || 'Admin';

        // Cover image (S3 URL from file.location, or file.path, or fallback coverImageUrl input)
        let thumbnailUrl = coverImageUrl.trim() || null;
        if (req.files?.coverImage?.[0]) {
            const f = req.files.coverImage[0];
            thumbnailUrl = f.location || f.path || `/uploads/information-center/covers/${f.filename}`;
        }

        // Insert post
        const [result] = await pool.query(
            `INSERT INTO information_posts
              (title, category, domains, status, web, rich_content, tags_count, tags_list,
               thumbnail_url, action_button_label, action_button_url, action_button_external,
               created_by_name, updated_by_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                category,
                JSON.stringify(domainsArr),
                status,
                webFlag,
                req.body.content || '',
                tagsArr.length,
                JSON.stringify(tagsArr),
                thumbnailUrl,
                showCTA ? (ctaLabel.trim() || 'Learn More') : null,
                showCTA ? (ctaUrl.trim() || null) : null,
                showCTA && ctaUrl.includes('http') ? 1 : 0,
                adminName,
                adminName,
            ]
        );

        const postId = result.insertId;

        // Insert attachments
        if (req.files?.attachments?.length > 0) {
            for (const file of req.files.attachments) {
                const sizeMB = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
                const fileUrl = file.location || file.path || `/uploads/information-center/attachments/${file.filename}`;
                await pool.query(
                    `INSERT INTO information_post_attachments (post_id, name, size, mime_type, url)
                     VALUES (?, ?, ?, ?, ?)`,
                    [postId, file.originalname, sizeMB, file.mimetype, fileUrl]
                );
            }
        }

        // Activity log
        await pool.query(
            `INSERT INTO information_post_activity (post_id, author_name, text) VALUES (?, ?, ?)`,
            [postId, adminName, 'Post created']
        );

        const [newPost] = await pool.query('SELECT * FROM information_posts WHERE id = ?', [postId]);
        const attachments = await getAttachments(postId);
        res.status(201).json({ success: true, data: buildPostResponse(newPost[0], attachments) });
    } catch (err) {
        console.error('[InformationCenter] create error:', err);
        res.status(500).json({ success: false, message: 'Failed to create post.' });
    }
};

/**
 * PUT /api/information-center/:id
 * multipart/form-data
 */
export const update = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await pool.query('SELECT * FROM information_posts WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ success: false, message: 'Post not found.' });

        const row = existing[0];
        const {
            title, status, web,
            domains, tagsList,
            showActionButton, ctaLabel = '', ctaUrl = '',
            attachmentsToRemove, coverImageUrl,
        } = req.body;

        // Validation
        if (title !== undefined && !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
        }
        const validStatuses = ['Draft', 'Scheduled', 'Published'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
        }

        const domainsArr  = domains  !== undefined ? safeJSON(domains,  []) : safeJSON(row.domains, []);
        const tagsArr     = tagsList !== undefined ? safeJSON(tagsList,  []) : safeJSON(row.tags_list, []);
        const showCTA     = showActionButton !== undefined
                              ? (showActionButton === 'true' || showActionButton === true)
                              : Boolean(row.action_button_label);
        const adminName   = req.admin?.full_name || 'Admin';
        const newTitle    = title    !== undefined ? title.trim()  : row.title;
        const newStatus   = status   !== undefined ? status        : row.status;
        const webFlag     = newStatus === 'Published' ? 1 : 0;
        const newCategory = domainsArr[0] || row.category || 'Other';
        const newContent  = req.body.content !== undefined ? req.body.content : row.rich_content;

        // Cover image logic
        let newThumbnailUrl = row.thumbnail_url;
        if (req.files?.coverImage?.[0]) {
            if (row.thumbnail_url) {
                await deleteMediaFile(row.thumbnail_url);
            }
            const f = req.files.coverImage[0];
            newThumbnailUrl = f.location || f.path || `/uploads/information-center/covers/${f.filename}`;
        } else if (coverImageUrl !== undefined && coverImageUrl.trim()) {
            newThumbnailUrl = coverImageUrl.trim();
        }

        // Remove cover image if explicitly cleared
        if (req.body.removeCoverImage === 'true') {
            if (row.thumbnail_url) {
                await deleteMediaFile(row.thumbnail_url);
            }
            newThumbnailUrl = null;
        }

        await pool.query(
            `UPDATE information_posts SET
              title = ?, category = ?, domains = ?, status = ?, web = ?,
              rich_content = ?, tags_count = ?, tags_list = ?,
              thumbnail_url = ?,
              action_button_label = ?, action_button_url = ?, action_button_external = ?,
              updated_by_name = ?
             WHERE id = ?`,
            [
                newTitle,
                newCategory,
                JSON.stringify(domainsArr),
                newStatus,
                webFlag,
                newContent,
                tagsArr.length,
                JSON.stringify(tagsArr),
                newThumbnailUrl,
                showCTA ? (ctaLabel.trim() || 'Learn More') : null,
                showCTA ? (ctaUrl.trim() || null) : null,
                showCTA && ctaUrl.includes('http') ? 1 : 0,
                adminName,
                id,
            ]
        );

        // Remove specified attachments
        const toRemove = safeJSON(attachmentsToRemove, []);
        if (toRemove.length > 0) {
            const [attRows] = await pool.query(
                `SELECT id, url FROM information_post_attachments WHERE id IN (${toRemove.map(() => '?').join(',')}) AND post_id = ?`,
                [...toRemove, id]
            );
            for (const att of attRows) {
                await deleteMediaFile(att.url);
            }
            await pool.query(
                `DELETE FROM information_post_attachments WHERE id IN (${toRemove.map(() => '?').join(',')}) AND post_id = ?`,
                [...toRemove, id]
            );
        }

        // Insert new attachments
        if (req.files?.attachments?.length > 0) {
            for (const file of req.files.attachments) {
                const sizeMB = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
                const fileUrl = file.location || file.path || `/uploads/information-center/attachments/${file.filename}`;
                await pool.query(
                    `INSERT INTO information_post_attachments (post_id, name, size, mime_type, url)
                     VALUES (?, ?, ?, ?, ?)`,
                    [id, file.originalname, sizeMB, file.mimetype, fileUrl]
                );
            }
        }

        // Activity log
        await pool.query(
            `INSERT INTO information_post_activity (post_id, author_name, text) VALUES (?, ?, ?)`,
            [id, adminName, `Post updated — status: ${newStatus}`]
        );

        const [updatedPost] = await pool.query('SELECT * FROM information_posts WHERE id = ?', [id]);
        const attachments   = await getAttachments(parseInt(id));
        res.json({ success: true, data: buildPostResponse(updatedPost[0], attachments) });
    } catch (err) {
        console.error('[InformationCenter] update error:', err);
        res.status(500).json({ success: false, message: 'Failed to update post.' });
    }
};

/**
 * DELETE /api/information-center/:id
 */
export const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT id, title, thumbnail_url FROM information_posts WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Post not found.' });

        const post = rows[0];

        // Delete cover image
        if (post.thumbnail_url) {
            await deleteMediaFile(post.thumbnail_url);
        }

        // Delete attachment files
        const [attachments] = await pool.query(
            'SELECT url FROM information_post_attachments WHERE post_id = ?', [id]
        );
        for (const att of attachments) {
            await deleteMediaFile(att.url);
        }

        // DELETE cascade handles attachments + activity
        await pool.query('DELETE FROM information_posts WHERE id = ?', [id]);

        res.json({ success: true, message: `Post "${post.title}" deleted successfully.` });
    } catch (err) {
        console.error('[InformationCenter] remove error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete post.' });
    }
};

/**
 * GET /api/information-center/:id/activity
 */
export const getActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const [post] = await pool.query('SELECT id FROM information_posts WHERE id = ?', [id]);
        if (!post.length) return res.status(404).json({ success: false, message: 'Post not found.' });

        const [rows] = await pool.query(
            'SELECT id, author_name, text, time FROM information_post_activity WHERE post_id = ? ORDER BY time DESC',
            [id]
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('[InformationCenter] getActivity error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch activity log.' });
    }
};
