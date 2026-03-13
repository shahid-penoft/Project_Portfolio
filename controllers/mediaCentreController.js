import db from '../configs/db.js';
import { successResponse, errorResponse, slugify } from '../utils/helpers.js';
import { uploadMedia, uploadImage, runMulter } from '../configs/multer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseJson = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
};

// POST /api/media-centre/upload  (admin — multipart)
export const uploadMediaFile = async (req, res) => {
    try {
        await runMulter(uploadMedia, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);

        const fileUrl = `/uploads/${req.file.filename}`;
        const isVideo = req.file.mimetype.startsWith('video/');
        return successResponse(res, { url: fileUrl, type: isVideo ? 'video' : 'image' }, 'File uploaded successfully.');
    } catch (err) {
        console.error('[uploadMediaFile]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'File too large. Max 200 MB for videos, 10 MB for images.', 413);
        return errorResponse(res, err.message || 'Server error uploading file.');
    }
};

// POST /api/media-centre/posts/upload-video (admin)
export const uploadPostVideo = async (req, res) => {
    try {
        const { uploadMediaFields, runMulter: runMulterWrapper } = await import('../configs/multer.js');
        await runMulterWrapper(uploadMediaFields, req, res);

        const mainFile = req.files?.file?.[0];
        const thumbFile = req.files?.thumbnail?.[0];

        if (!mainFile) return errorResponse(res, 'No video file provided.', 400);

        return successResponse(res, {
            url: `/uploads/${mainFile.filename}`,
            thumbnail_url: thumbFile ? `/uploads/${thumbFile.filename}` : null
        }, 'Video uploaded.');
    } catch (err) {
        console.error('[uploadPostVideo]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'File too large.', 413);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// POST /api/media-centre/posts/:id/upload-inline-image  (admin)
export const uploadPostInlineImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No image file uploaded.', 400);

        const { id } = req.params;
        const [rows] = await db.query('SELECT id FROM media_posts WHERE id = ?', [id]);
        if (!rows.length) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return errorResponse(res, 'Post not found.', 404);
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;
        return successResponse(res, { url: fullUrl }, 'Image uploaded.');
    } catch (err) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('[uploadPostInlineImage]', err);
        return errorResponse(res, err.message || 'Server error uploading image.');
    }
};


// ╔══════════════════════════════════════════════════════════════╗
//  SECTIONS
// ╚══════════════════════════════════════════════════════════════╝

// GET /api/media-centre/sections  (public)
export const getPublicSections = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM media_sections WHERE is_active = 1 ORDER BY display_order ASC, section_name ASC'
        );
        return successResponse(res, { data: rows }, 'Sections fetched successfully.');
    } catch (err) {
        console.error('[getPublicSections]', err);
        return errorResponse(res, 'Server error fetching sections.');
    }
};

// GET /api/media-centre/sections/all  (admin)
export const getAllSections = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM media_sections ORDER BY display_order ASC, section_name ASC'
        );
        return successResponse(res, { data: rows }, 'All sections fetched successfully.');
    } catch (err) {
        console.error('[getAllSections]', err);
        return errorResponse(res, 'Server error fetching sections.');
    }
};

// POST /api/media-centre/sections  (admin)
export const createSection = async (req, res) => {
    try {
        const { section_name, description, display_order = 0, is_active = 1, media_type = 'article' } = req.body;
        if (!section_name) return errorResponse(res, 'section_name is required.', 400);

        const [result] = await db.query(
            'INSERT INTO media_sections (section_name, description, display_order, is_active, media_type) VALUES (?, ?, ?, ?, ?)',
            [section_name.trim(), description || null, display_order, is_active ? 1 : 0, media_type]
        );
        const [rows] = await db.query('SELECT * FROM media_sections WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: rows[0] }, 'Section created successfully.', 201);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A section with this name already exists.', 409);
        console.error('[createSection]', err);
        return errorResponse(res, 'Server error creating section.');
    }
};

// PUT /api/media-centre/sections/:id  (admin)
export const updateSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { section_name, description, display_order, is_active, media_type = 'article' } = req.body;
        if (!section_name) return errorResponse(res, 'section_name is required.', 400);

        const [result] = await db.query(
            `UPDATE media_sections
       SET section_name = ?, description = ?, display_order = ?, is_active = ?, media_type = ?
       WHERE id = ?`,
            [section_name.trim(), description || null, display_order ?? 0, is_active ? 1 : 0, media_type, id]
        );
        if (!result.affectedRows) return errorResponse(res, 'Section not found.', 404);
        const [rows] = await db.query('SELECT * FROM media_sections WHERE id = ?', [id]);
        return successResponse(res, { data: rows[0] }, 'Section updated successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A section with this name already exists.', 409);
        console.error('[updateSection]', err);
        return errorResponse(res, 'Server error updating section.');
    }
};

// DELETE /api/media-centre/sections/:id  (admin)
export const deleteSection = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM media_sections WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return errorResponse(res, 'Section not found.', 404);
        return successResponse(res, {}, 'Section deleted successfully.');
    } catch (err) {
        console.error('[deleteSection]', err);
        return errorResponse(res, 'Server error deleting section.');
    }
};

// ╔══════════════════════════════════════════════════════════════╗
//  POSTS
// ╚══════════════════════════════════════════════════════════════╝

// GET /api/media-centre/latest  (public — featured posts)
export const getLatestUpdates = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 6);
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM media_posts mp
             JOIN media_sections ms ON ms.id = mp.section_id
             WHERE mp.is_featured = 1 AND ms.is_active = 1`
        );

        const [rows] = await db.query(
            `SELECT mp.*, ms.section_name
             FROM media_posts mp
             JOIN media_sections ms ON ms.id = mp.section_id
             WHERE mp.is_featured = 1 AND ms.is_active = 1
             ORDER BY mp.published_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        }, 'Latest updates fetched successfully.');
    } catch (err) {
        console.error('[getLatestUpdates]', err);
        return errorResponse(res, 'Server error fetching latest updates.');
    }
};

// GET /api/media-centre/all-updates (public — all posts sorted by date)
export const getAllUpdates = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const offset = (page - 1) * limit;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM media_posts mp
             JOIN media_sections ms ON ms.id = mp.section_id
             WHERE ms.is_active = 1`
        );

        const [rows] = await db.query(
            `SELECT mp.*, ms.section_name
             FROM media_posts mp
             JOIN media_sections ms ON ms.id = mp.section_id
             WHERE ms.is_active = 1
             ORDER BY mp.published_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { 
                total, 
                page, 
                limit, 
                totalPages: Math.ceil(total / limit) 
            }
        }, 'All updates fetched successfully.');
    } catch (err) {
        console.error('[getAllUpdates]', err);
        return errorResponse(res, 'Server error fetching all updates.');
    }
};

// GET /api/media-centre/sections/:id/posts  (public — posts for a section)
export const getPostsBySection = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const offset = (page - 1) * limit;
        const { id } = req.params;

        // Verify section is active
        const [secRows] = await db.query(
            'SELECT * FROM media_sections WHERE id = ? AND is_active = 1', [id]
        );
        if (!secRows.length) return errorResponse(res, 'Section not found.', 404);

        const [[{ total }]] = await db.query(
            'SELECT COUNT(*) AS total FROM media_posts WHERE section_id = ?', [id]
        );
        const [rows] = await db.query(
            'SELECT * FROM media_posts WHERE section_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?',
            [id, limit, offset]
        );

        return successResponse(res, {
            section: secRows[0],
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Posts fetched successfully.');
    } catch (err) {
        console.error('[getPostsBySection]', err);
        return errorResponse(res, 'Server error fetching posts.');
    }
};

// GET /api/media-centre/posts  (admin — all posts with section name)
export const getAllPosts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const offset = (page - 1) * limit;
        const { section_id, is_featured, search } = req.query;

        let where = 'WHERE 1=1';
        const params = [];
        if (section_id) { where += ' AND mp.section_id = ?'; params.push(section_id); }
        if (is_featured !== undefined) { where += ' AND mp.is_featured = ?'; params.push(is_featured ? 1 : 0); }
        if (search) { where += ' AND mp.title LIKE ?'; params.push(`%${search}%`); }

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM media_posts mp ${where}`, params
        );
        const [rows] = await db.query(
            `SELECT mp.*, ms.section_name
       FROM media_posts mp
       JOIN media_sections ms ON ms.id = mp.section_id
       ${where}
       ORDER BY mp.published_at DESC
       LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Posts fetched successfully.');
    } catch (err) {
        console.error('[getAllPosts]', err);
        return errorResponse(res, 'Server error fetching posts.');
    }
};

// GET /api/media-centre/posts/:id  (public)
export const getPostById = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT mp.*, ms.section_name
       FROM media_posts mp
       JOIN media_sections ms ON ms.id = mp.section_id
       WHERE mp.id = ?`,
            [req.params.id]
        );
        if (!rows.length) return errorResponse(res, 'Post not found.', 404);
        
        const p = rows[0];
        p.images = parseJson(p.images);
        p.videos = parseJson(p.videos);

        return successResponse(res, { data: p }, 'Post fetched successfully.');
    } catch (err) {
        console.error('[getPostById]', err);
        return errorResponse(res, 'Server error fetching post.');
    }
};

// POST /api/media-centre/posts  (admin)
export const createPost = async (req, res) => {
    try {
        const { section_id, title, author, content, rich_content, thumbnail_url, video_url, images = [], videos = [], is_featured = 0, published_at } = req.body;
        if (!section_id || !title) return errorResponse(res, 'section_id and title are required.', 400);

        const [secRows] = await db.query('SELECT id FROM media_sections WHERE id = ?', [section_id]);
        if (!secRows.length) return errorResponse(res, 'Section not found.', 404);

        const slug = slugify(title);

        const [result] = await db.query(
            `INSERT INTO media_posts (section_id, title, slug, author, content, rich_content, thumbnail_url, video_url, images, videos, is_featured, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                section_id, title, slug, author || 'Office of Shibu Theckumpuram', content || null, rich_content || null,
                thumbnail_url || null, video_url || null,
                JSON.stringify(images),
                JSON.stringify(videos),
                is_featured ? 1 : 0,
                published_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
            ]
        );

        const [rows] = await db.query(
            `SELECT mp.*, ms.section_name FROM media_posts mp
       JOIN media_sections ms ON ms.id = mp.section_id WHERE mp.id = ?`,
            [result.insertId]
        );
        return successResponse(res, { data: rows[0] }, 'Post created successfully.', 201);
    } catch (err) {
        console.error('[createPost]', err);
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A post with this title already exists.', 409);
        return errorResponse(res, 'Server error creating post.');
    }
};


// PUT /api/media-centre/posts/:id  (admin)
export const updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { section_id, title, author, content, rich_content, thumbnail_url, video_url, images = [], videos = [], is_featured, published_at } = req.body;
        if (!section_id || !title) return errorResponse(res, 'section_id and title are required.', 400);

        const slug = slugify(title);

        const [result] = await db.query(
            `UPDATE media_posts SET
         section_id = ?, title = ?, slug = ?, author = ?, content = ?, rich_content = ?,
         thumbnail_url = ?, video_url = ?, images = ?, videos = ?, is_featured = ?, published_at = ?
       WHERE id = ?`,
            [
                section_id, title, slug, author || 'Office of Shibu Theckumpuram', content || null, rich_content || null,
                thumbnail_url || null, video_url || null,
                JSON.stringify(images),
                JSON.stringify(videos),
                is_featured ? 1 : 0,
                published_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
                id,
            ]
        );
        if (!result.affectedRows) return errorResponse(res, 'Post not found.', 404);
        const [rows] = await db.query(
            `SELECT mp.*, ms.section_name FROM media_posts mp
       JOIN media_sections ms ON ms.id = mp.section_id WHERE mp.id = ?`,
            [id]
        );
        return successResponse(res, { data: rows[0] }, 'Post updated successfully.');
    } catch (err) {
        console.error('[updatePost]', err);
        if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 'A post with this title already exists.', 409);
        return errorResponse(res, 'Server error updating post.');
    }
};

// GET /api/media-centre/posts/slug/:slug  (public)
export const getPostBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const [rows] = await db.query(
            `SELECT mp.*, ms.section_name
       FROM media_posts mp
       JOIN media_sections ms ON ms.id = mp.section_id
       WHERE mp.slug = ?`,
            [slug]
        );
        if (!rows.length) return errorResponse(res, 'Post not found.', 404);

        const p = rows[0];
        p.images = parseJson(p.images);
        p.videos = parseJson(p.videos);

        return successResponse(res, { data: p }, 'Post fetched successfully.');
    } catch (err) {
        console.error('[getPostBySlug]', err);
        return errorResponse(res, 'Server error fetching post.');
    }
};

// DELETE /api/media-centre/posts/:id  (admin)
export const deletePost = async (req, res) => {
    try {
        const [result] = await db.query('DELETE FROM media_posts WHERE id = ?', [req.params.id]);
        if (!result.affectedRows) return errorResponse(res, 'Post not found.', 404);
        return successResponse(res, {}, 'Post deleted successfully.');
    } catch (err) {
        console.error('[deletePost]', err);
        return errorResponse(res, 'Server error deleting post.');
    }
};
