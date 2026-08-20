import db from '../configs/db.js';
import { successResponse, errorResponse, slugify, renameMediaToSeoFriendly } from '../utils/helpers.js';

import { uploadImage, runMulter } from '../configs/multerS3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

const filterValidMediaUrls = (items, preserveCoverSlot = false) => {
    if (!Array.isArray(items)) return [];
    return items.filter((item, idx) => {
        if (preserveCoverSlot && idx === 0 && (item === null || item === '')) return true;
        if (!item) return false;
        const url = typeof item === 'string' ? item : (item.url || item.file_url || '');
        if (typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return false;
        return true;
    });
};

// ── Helpers ────────────────────────────────────────────────────
const parseImages = (raw) => {
    if (!raw) return [];
    let parsed = [];
    if (Array.isArray(raw)) parsed = raw;
    else {
        try { parsed = JSON.parse(raw); } catch { parsed = []; }
    }
    return filterValidMediaUrls(parsed, true);
};

const parseVideos = (raw) => {
    if (!raw) return [];
    let parsed = [];
    if (Array.isArray(raw)) parsed = raw;
    else {
        try { parsed = JSON.parse(raw); } catch { parsed = []; }
    }
    return filterValidMediaUrls(parsed);
};

const deleteFile = (item) => {
    if (!item) return;
    const url = typeof item === 'string' ? item : (item?.url || item?.path || '');
    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return;
    const filePath = path.join(uploadDir, path.basename(url));
    fs.unlink(filePath, () => { }); // best-effort
};

// ── POST /api/projects/upload  (admin) ─────────────────────────
export const uploadProjectImage = async (req, res) => {
    try {
        await runMulter(uploadImage, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, { url: req.file.location || `/uploads/${req.file.filename}` }, 'Image uploaded.');
    } catch (err) {
        console.error('[uploadProjectImage]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// ── POST /api/projects/upload-video (admin) ────────────────────
export const uploadProjectVideo = async (req, res) => {
    try {
        const { uploadMediaFields: multerFields, runMulter: runMulterWrapper } = await import('../configs/multerS3.js');
        await runMulterWrapper(multerFields, req, res);

        const mainFile = req.files?.file?.[0];
        const thumbFile = req.files?.thumbnail?.[0];

        if (!mainFile) return errorResponse(res, 'No video file provided.', 400);

        return successResponse(res, {
            url: mainFile.location || `/uploads/${mainFile.filename}`,
            thumbnail_url: thumbFile ? (thumbFile.location || `/uploads/${thumbFile.filename}`) : null
        }, 'Video uploaded.');
    } catch (err) {
        console.error('[uploadProjectVideo]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'File too large.', 413);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// ── POST /api/projects/:id/upload-inline-image (admin) ─────────
export const uploadProjectInlineImage = async (req, res) => {
    try {
        console.log('[uploadProjectInlineImage] Starting upload for ID:', req.params.id);
        await runMulter(uploadImage, req, res);

        if (!req.file) {
            console.error('[uploadProjectInlineImage] No file in request');
            return errorResponse(res, 'No image file uploaded.', 400);
        }

        const { id } = req.params;
        // Check project exists
        const [rows] = await db.query('SELECT id FROM projects WHERE id = ?', [id]);
        if (!rows.length) {
            console.error('[uploadProjectInlineImage] Project not found for ID:', id);
            if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return errorResponse(res, 'Project not found.', 404);
        }

        const fullUrl = req.file.location || `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        console.log('[uploadProjectInlineImage] Success, URL:', fullUrl);
        return successResponse(res, { url: fullUrl }, 'Image uploaded for editor.');
    } catch (err) {
        console.error('[uploadProjectInlineImage] Error trapped:', err);
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Image too large (max 10 MB).', 413);
        return errorResponse(res, err.message || 'Server error uploading image.');
    }
};

// ── Helper: Build dynamic filters & sorting for projects ──────────
function buildProjectFiltersAndSort(query, defaultConditions = ['COALESCE(p.is_deleted, 0) = 0']) {
    const conditions = [...defaultConditions];
    const vals = [];

    const {
        search, q,
        type, project_type,
        project_sub_type, sub_type,
        category,
        department_id, department,
        sector_id, sector,
        local_body_id, local_body,
        ward_id, ward,
        status,
        year,
        is_active, visibility,
        sortBy, sort_by,
        sortOrder, sort_order, order
    } = query;

    // Helper for multi-value / array / comma-separated parameters
    const parseValues = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
        if (typeof val === 'string') return val.split(',').map(v => v.trim()).filter(Boolean);
        return [String(val).trim()];
    };

    // Project Type (MLA vs Portfolio vs specific)
    const effectiveType = type || project_type;
    if (effectiveType === 'MLA') {
        conditions.push("p.project_type = 'MLA'");
    } else if (effectiveType === 'PORTFOLIO' || effectiveType === 'other') {
        conditions.push("p.project_type != 'MLA'");
    } else if (effectiveType && effectiveType !== 'all') {
        conditions.push('p.project_type = ?');
        vals.push(effectiveType);
    }

    // Project Sub Type (e.g. MLA Projects, Ente Nadu Projects, etc.)
    const subTypeVals = parseValues(project_sub_type || sub_type).filter(v => v !== 'all');
    if (subTypeVals.length === 1) {
        conditions.push('p.project_sub_type = ?');
        vals.push(subTypeVals[0]);
    } else if (subTypeVals.length > 1) {
        conditions.push(`p.project_sub_type IN (${subTypeVals.map(() => '?').join(',')})`);
        vals.push(...subTypeVals);
    }

    // System Category (p.category)
    const catVals = parseValues(category).filter(v => v !== 'all');
    if (catVals.length === 1) {
        conditions.push('p.category = ?');
        vals.push(catVals[0]);
    } else if (catVals.length > 1) {
        conditions.push(`p.category IN (${catVals.map(() => '?').join(',')})`);
        vals.push(...catVals);
    }

    // Department (p.department_id or d.name or JSON departments)
    const deptVals = parseValues(department_id || department).filter(v => v !== 'all');
    if (deptVals.length === 1) {
        if (!isNaN(deptVals[0])) {
            conditions.push('(p.department_id = ? OR JSON_CONTAINS(p.departments, ?))');
            vals.push(deptVals[0], JSON.stringify(Number(deptVals[0])));
        } else {
            conditions.push('(d.name = ? OR JSON_CONTAINS(p.departments, ?))');
            vals.push(deptVals[0], JSON.stringify(deptVals[0]));
        }
    } else if (deptVals.length > 1) {
        const numericIds = deptVals.filter(v => !isNaN(v)).map(Number);
        const stringNames = deptVals.filter(v => isNaN(v));
        const orClauses = [];
        if (numericIds.length > 0) {
            orClauses.push(`p.department_id IN (${numericIds.map(() => '?').join(',')})`);
            vals.push(...numericIds);
        }
        if (stringNames.length > 0) {
            orClauses.push(`d.name IN (${stringNames.map(() => '?').join(',')})`);
            vals.push(...stringNames);
        }
        conditions.push(`(${orClauses.join(' OR ')})`);
    }

    // Sector (p.sector_id)
    const sectorVals = parseValues(sector_id || sector).filter(v => v !== 'all');
    if (sectorVals.length === 1) {
        if (!isNaN(sectorVals[0])) {
            conditions.push('p.sector_id = ?');
            vals.push(Number(sectorVals[0]));
        } else {
            conditions.push('s.name = ?');
            vals.push(sectorVals[0]);
        }
    } else if (sectorVals.length > 1) {
        const numSectors = sectorVals.filter(v => !isNaN(v)).map(Number);
        if (numSectors.length > 0) {
            conditions.push(`p.sector_id IN (${numSectors.map(() => '?').join(',')})`);
            vals.push(...numSectors);
        } else {
            conditions.push(`s.name IN (${sectorVals.map(() => '?').join(',')})`);
            vals.push(...sectorVals);
        }
    }

    // Local Body (p.local_body_id)
    const lbVals = parseValues(local_body_id || local_body).filter(v => v !== 'all');
    if (lbVals.length === 1) {
        if (!isNaN(lbVals[0])) {
            conditions.push('p.local_body_id = ?');
            vals.push(Number(lbVals[0]));
        } else {
            conditions.push('lb.name = ?');
            vals.push(lbVals[0]);
        }
    } else if (lbVals.length > 1) {
        const numLb = lbVals.filter(v => !isNaN(v)).map(Number);
        if (numLb.length > 0) {
            conditions.push(`p.local_body_id IN (${numLb.map(() => '?').join(',')})`);
            vals.push(...numLb);
        } else {
            conditions.push(`lb.name IN (${lbVals.map(() => '?').join(',')})`);
            vals.push(...lbVals);
        }
    }

    // Ward (p.ward_id)
    const wardVals = parseValues(ward_id || ward).filter(v => v !== 'all');
    if (wardVals.length === 1) {
        conditions.push('p.ward_id = ?');
        vals.push(wardVals[0]);
    } else if (wardVals.length > 1) {
        conditions.push(`p.ward_id IN (${wardVals.map(() => '?').join(',')})`);
        vals.push(...wardVals);
    }

    // Status (p.status)
    const statusVals = parseValues(status).filter(v => v !== 'all');
    if (statusVals.length === 1) {
        conditions.push('p.status = ?');
        vals.push(statusVals[0]);
    } else if (statusVals.length > 1) {
        conditions.push(`p.status IN (${statusVals.map(() => '?').join(',')})`);
        vals.push(...statusVals);
    }

    // Visibility / is_active
    const effectiveActive = is_active !== undefined && is_active !== '' ? is_active : (
        visibility === 'active' ? 1 : (visibility === 'hidden' ? 0 : undefined)
    );
    if (effectiveActive !== undefined) {
        conditions.push('p.is_active = ?');
        vals.push(effectiveActive == 1 || effectiveActive === '1' || effectiveActive === 'true' ? 1 : 0);
    }

    // Year
    const yearVals = parseValues(year).filter(v => v !== 'all');
    if (yearVals.length === 1) {
        conditions.push('(p.year = ? OR YEAR(p.created_at) = ?)');
        vals.push(yearVals[0], yearVals[0]);
    } else if (yearVals.length > 1) {
        conditions.push(`(p.year IN (${yearVals.map(() => '?').join(',')}) OR YEAR(p.created_at) IN (${yearVals.map(() => '?').join(',')}))`);
        vals.push(...yearVals, ...yearVals);
    }

    // Search query (title, tags, description)
    const searchTerm = search || q;
    if (searchTerm) {
        conditions.push('(p.title LIKE ? OR p.tags LIKE ? OR p.description LIKE ?)');
        vals.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sorting
    const activeSortBy = (sortBy || sort_by || '').toLowerCase();
    const activeSortOrder = (sortOrder || sort_order || order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let orderBy = 'ORDER BY p.display_order ASC, p.created_at DESC';
    switch (activeSortBy) {
        case 'created_at':
            orderBy = `ORDER BY p.created_at ${activeSortOrder}`;
            break;
        case 'title':
            orderBy = `ORDER BY p.title ${activeSortOrder}`;
            break;
        case 'budget':
            orderBy = `ORDER BY p.budget ${activeSortOrder}`;
            break;
        case 'year':
            orderBy = `ORDER BY p.year ${activeSortOrder}, p.created_at DESC`;
            break;
        case 'start_date':
            orderBy = `ORDER BY p.start_date ${activeSortOrder}`;
            break;
        case 'end_date':
            orderBy = `ORDER BY p.end_date ${activeSortOrder}`;
            break;
        case 'display_order':
            orderBy = `ORDER BY p.display_order ${activeSortOrder}`;
            break;
        case 'progress':
            orderBy = `ORDER BY progress ${activeSortOrder}`;
            break;
        case 'status':
            orderBy = `ORDER BY p.status ${activeSortOrder}`;
            break;
        default:
            orderBy = 'ORDER BY p.display_order ASC, p.created_at DESC';
            break;
    }

    return { where, vals, orderBy };
}

// ── GET /api/projects/all  (admin, paginated) ──────────────────
export const getAllProjects = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;

        const { where, vals, orderBy } = buildProjectFiltersAndSort(req.query);

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM projects p 
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN departments d ON d.id = p.department_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             ${where}`, vals
        );
        const [rows] = await db.query(
            `SELECT p.id, p.title, p.slug, p.description, p.project_content,
                    p.images, p.videos, p.tags, p.year, p.sector_id, p.category, p.local_body_id, p.ward_id,
                    p.display_order, p.is_active, p.status, p.start_date, p.end_date,
                    p.created_at, p.updated_at, p.project_type, p.project_sub_type,
                    s.name AS sector_name, lb.name AS local_body_name, d.name AS department_name,
                    w.ward_no, w.place_name AS ward_name,
                    (IFNULL(JSON_LENGTH(p.images), 0) + IFNULL(JSON_LENGTH(p.videos), 0)) AS media_count,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_total,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') AS milestones_completed,
                    (CASE 
                        WHEN (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) > 0 
                        THEN ROUND(((SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') * 100.0) / (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id))
                        WHEN p.status = 'Completed' THEN 100
                        ELSE 0
                    END) AS progress
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN departments d ON d.id = p.department_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             ${where}
             ${orderBy}
             LIMIT ? OFFSET ?`,
            [...vals, limit, offset]
        );

        // Parse images/videos JSON for each row so frontend gets real arrays
        const parsedRows = rows.map(r => ({
            ...r,
            images: (() => { try { return typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []); } catch { return []; } })(),
            videos: (() => { try { return typeof r.videos === 'string' ? JSON.parse(r.videos) : (r.videos || []); } catch { return []; } })(),
        }));

        return successResponse(res, {
            data: parsedRows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Projects fetched.');
    } catch (err) {
        console.error('[getAllProjects]', err);
        return errorResponse(res, 'Server error fetching projects.');
    }
};

// ── GET /api/projects/public/year/:year ────────────────────────
export const getProjectsByYear = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;
        const { year } = req.params;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM projects p WHERE p.is_active = 1 AND p.year = ?`, [year]
        );
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, w.ward_no, w.place_name AS ward_name,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_total,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') AS milestones_completed,
                    (CASE 
                        WHEN (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) > 0 
                        THEN ROUND(((SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') * 100.0) / (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id))
                        WHEN p.status = 'Completed' THEN 100
                        ELSE 0
                    END) AS progress
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             WHERE p.is_active = 1 AND p.year = ?
             ORDER BY p.display_order ASC, p.created_at DESC
             LIMIT ? OFFSET ?`,
            [year, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Projects fetched.');
    } catch (err) {
        console.error('[getProjectsByYear]', err);
        return errorResponse(res, 'Server error fetching projects.');
    }
};

// ── GET /api/projects/public/local-body/:id ────────────────────
export const getProjectsByLocalBody = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;
        const { id } = req.params;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM projects p WHERE p.is_active = 1 AND p.local_body_id = ?`, [id]
        );
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, w.ward_no, w.place_name AS ward_name,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_total,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') AS milestones_completed,
                    (CASE 
                        WHEN (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) > 0 
                        THEN ROUND(((SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') * 100.0) / (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id))
                        WHEN p.status = 'Completed' THEN 100
                        ELSE 0
                    END) AS progress
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             WHERE p.is_active = 1 AND p.local_body_id = ?
             ORDER BY p.display_order ASC, p.created_at DESC
             LIMIT ? OFFSET ?`,
            [id, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Projects fetched.');
    } catch (err) {
        console.error('[getProjectsByLocalBody]', err);
        return errorResponse(res, 'Server error fetching projects.');
    }
};

// ── GET /api/projects/public/sector/:id ────────────────────────
export const getProjectsBySector = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;
        const { id } = req.params;

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total FROM projects p WHERE p.is_active = 1 AND p.sector_id = ?`, [id]
        );
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, w.ward_no, w.place_name AS ward_name,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_total,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') AS milestones_completed,
                    (CASE 
                        WHEN (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) > 0 
                        THEN ROUND(((SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') * 100.0) / (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id))
                        WHEN p.status = 'Completed' THEN 100
                        ELSE 0
                    END) AS progress
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             WHERE p.is_active = 1 AND p.sector_id = ?
             ORDER BY p.display_order ASC, p.created_at DESC
             LIMIT ? OFFSET ?`,
            [id, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Projects fetched.');
    } catch (err) {
        console.error('[getProjectsBySector]', err);
        return errorResponse(res, 'Server error fetching projects.');
    }
};

// ── GET /api/projects/public/sector-name/:sectorName ───────────
export const getProjectsBySectorName = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;
        const { sectorName } = req.params;

        // Perform a JOIN to filter by the readable sector_name
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM projects p 
             JOIN sectors s ON s.id = p.sector_id
             WHERE p.is_active = 1 AND s.name = ?`, [sectorName]
        );
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name
             FROM projects p
             JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             WHERE p.is_active = 1 AND s.name = ?
             ORDER BY p.display_order ASC, p.created_at DESC
             LIMIT ? OFFSET ?`,
            [sectorName, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Projects fetched by sector name.');
    } catch (err) {
        console.error('[getProjectsBySectorName]', err);
        return errorResponse(res, 'Server error fetching projects.');
    }
};

// ── GET /api/projects/public/search ────────────────────────────
export const searchPublicProjects = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 12);
        const offset = (page - 1) * limit;

        const { where, vals, orderBy } = buildProjectFiltersAndSort(req.query, ['p.is_active = 1']);

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM projects p 
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN departments d ON d.id = p.department_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             ${where}`, vals
        );
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, d.name AS department_name, w.ward_no, w.place_name AS ward_name,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_total,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') AS milestones_completed,
                    (CASE 
                        WHEN (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) > 0 
                        THEN ROUND(((SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') * 100.0) / (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id))
                        WHEN p.status = 'Completed' THEN 100
                        ELSE 0
                    END) AS progress
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN departments d ON d.id = p.department_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             ${where}
             ${orderBy}
             LIMIT ? OFFSET ?`,
            [...vals, limit, offset]
        );

        return successResponse(res, {
            data: rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        }, 'Projects fetched.');
    } catch (err) {
        console.error('[searchPublicProjects]', err);
        return errorResponse(res, 'Server error fetching projects.');
    }
};

// ── GET /api/projects/public/slug/:slug ────────────────────────
export const getProjectBySlug = async (req, res) => {
    console.log('[DEBUG] getProjectBySlug called with:', req.params.slug);
    try {
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, d.name AS department_name,
                    w.ward_no, w.place_name AS ward_name,
                    au1.full_name AS created_by_name, au2.full_name AS updated_by_name,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_total,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') AS milestones_completed,
                    (CASE 
                        WHEN (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) > 0 
                        THEN ROUND(((SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') * 100.0) / (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id))
                        WHEN p.status = 'Completed' THEN 100
                        ELSE 0
                    END) AS progress
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN departments d ON d.id = p.department_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             LEFT JOIN admin_users au1 ON p.created_by = au1.id
             LEFT JOIN admin_users au2 ON p.updated_by = au2.id
             WHERE p.slug = ?`, [req.params.slug]
        );
        if (!rows.length) return errorResponse(res, 'Project not found.', 404);

        const p = rows[0];
        p.created_by = p.created_by_name;
        p.updated_by = p.updated_by_name;
        p.images = parseImages(p.images);
        p.videos = parseVideos(p.videos);
        p.departments = typeof p.departments === 'string' ? JSON.parse(p.departments) : (p.departments || []);

        const id = p.id;

        // Hydrate related tables
        const [[milestones], [updates], [attachments], [budget_entries], [budget_allocations], [contractors], [team], [activity_log]] = await Promise.all([
            db.query('SELECT * FROM project_milestones WHERE project_id = ? ORDER BY display_order ASC, target_date ASC', [id]),
            db.query(`SELECT u.*, au.full_name as author_name 
                      FROM project_updates u 
                      LEFT JOIN admin_users au ON u.created_by = au.id 
                      WHERE project_id = ? ORDER BY u.created_at DESC`, [id]),
            db.query('SELECT * FROM project_attachments WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query('SELECT * FROM project_budget_entries WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query('SELECT * FROM project_budget_allocations WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query('SELECT * FROM project_contractors WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query(`SELECT t.*, au.full_name as name, r.name as role, au.profile_image 
                      FROM project_team_members t
                      JOIN admin_users au ON t.admin_user_id = au.id
                      LEFT JOIN admin_roles r ON au.role_id = r.id
                      WHERE project_id = ? ORDER BY t.assigned_at DESC`, [id]),
            db.query(`SELECT l.*, au.full_name as author_name 
                      FROM project_activity_logs l
                      LEFT JOIN admin_users au ON l.admin_user_id = au.id
                      WHERE project_id = ? ORDER BY l.created_at DESC LIMIT 50`, [id])
        ]);

        // Attach media to updates
        if (updates.length > 0) {
            const updateIds = updates.map(u => u.id);
            const [media] = await db.query('SELECT * FROM project_update_media WHERE update_id IN (?)', [updateIds]);
            updates.forEach(u => {
                u.media = media.filter(m => m.update_id === u.id);
            });
        }

        p.milestones = milestones;
        p.updates = updates;
        p.attachments = attachments;
        p.budget_entries = budget_entries;
        p.budget_allocations = budget_allocations;
        p.contractors = contractors;
        p.team = team;
        p.activity_log = activity_log;

        return successResponse(res, { data: p }, 'Project fetched.');
    } catch (err) {
        console.error('[getProjectBySlug]', err);
        return errorResponse(res, 'Server error.');
    }
};

// ── GET /api/projects/:id  ─────────────────────────────────────
export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, d.name AS department_name, p.images, p.videos,
                    w.ward_no, w.place_name AS ward_name,
                    au1.full_name AS created_by_name, au2.full_name AS updated_by_name,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) AS milestones_total,
                    (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') AS milestones_completed,
                    (CASE 
                        WHEN (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id) > 0 
                        THEN ROUND(((SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.status = 'Done') * 100.0) / (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id))
                        WHEN p.status = 'Completed' THEN 100
                        ELSE 0
                    END) AS progress
             FROM projects p
             LEFT JOIN sectors s     ON s.id  = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN departments d ON d.id = p.department_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             LEFT JOIN admin_users au1 ON p.created_by = au1.id
             LEFT JOIN admin_users au2 ON p.updated_by = au2.id
             WHERE p.id = ?`,
            [id]
        );
        if (!rows.length) return errorResponse(res, 'Project not found.', 404);

        const p = rows[0];
        p.created_by = p.created_by_name;
        p.updated_by = p.updated_by_name;
        p.images = parseImages(p.images);
        p.videos = parseVideos(p.videos);
        p.departments = typeof p.departments === 'string' ? JSON.parse(p.departments) : (p.departments || []);

        // Hydrate related tables
        const [[milestones], [updates], [attachments], [budget_entries], [budget_allocations], [contractors], [team], [activity_log]] = await Promise.all([
            db.query('SELECT * FROM project_milestones WHERE project_id = ? ORDER BY display_order ASC, target_date ASC', [id]),
            db.query(`SELECT u.*, au.full_name as author_name 
                      FROM project_updates u 
                      LEFT JOIN admin_users au ON u.created_by = au.id 
                      WHERE project_id = ? ORDER BY u.created_at DESC`, [id]),
            db.query('SELECT * FROM project_attachments WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query('SELECT * FROM project_budget_entries WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query('SELECT * FROM project_budget_allocations WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query('SELECT * FROM project_contractors WHERE project_id = ? ORDER BY created_at DESC', [id]),
            db.query(`SELECT t.*, au.full_name as name, r.name as role, au.profile_image 
                      FROM project_team_members t
                      JOIN admin_users au ON t.admin_user_id = au.id
                      LEFT JOIN admin_roles r ON au.role_id = r.id
                      WHERE project_id = ? ORDER BY t.assigned_at DESC`, [id]),
            db.query(`SELECT l.*, au.full_name as author_name 
                      FROM project_activity_logs l
                      LEFT JOIN admin_users au ON l.admin_user_id = au.id
                      WHERE project_id = ? ORDER BY l.created_at DESC LIMIT 50`, [id])
        ]);

        // Attach media to updates
        if (updates.length > 0) {
            const updateIds = updates.map(u => u.id);
            const [media] = await db.query('SELECT * FROM project_update_media WHERE update_id IN (?)', [updateIds]);
            updates.forEach(u => {
                u.media = media.filter(m => m.update_id === u.id);
            });
        }

        p.milestones = milestones;
        p.updates = updates;
        p.attachments = attachments;
        p.budget_entries = budget_entries;
        p.budget_allocations = budget_allocations;
        p.contractors = contractors;
        p.team = team;
        p.activity_log = activity_log;

        return successResponse(res, { data: p }, 'Project fetched.');
    } catch (err) {
        console.error('[getProjectById]', err);
        return errorResponse(res, 'Server error.');
    }
};

const sanitizeDate = (val) => {
    if (!val) return null;
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'Invalid Date') return null;
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
};

const sanitizeNumber = (val, defaultVal = 0) => {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.-]+/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? defaultVal : parsed;
    }
    const parsed = Number(val);
    return isNaN(parsed) ? defaultVal : parsed;
};

const sanitizeId = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return isNaN(num) || num <= 0 ? null : num;
};

const sanitizeProjectType = (type) => {
    if (!type) return 'MLA';
    const upper = String(type).trim().toUpperCase();
    if (upper === 'PORTFOLIO' || upper.includes('PORTFOLIO')) return 'PORTFOLIO';
    return 'MLA';
};

// ── POST /api/projects  (admin) ────────────────────────────────
export const createProject = async (req, res) => {
    try {
        const {
            title, description, project_content, images = [], videos = [], tags,
            year, sector_id, category, local_body_id,
            display_order = 0, is_active = 1,
            status = 'In Progress', ward_id, start_date, end_date,
            actual_start_date, actual_end_date, location, departments = [], department_id, budget = 0.00,
            project_type = 'MLA', project_sub_type, milestones = [], team = [], contractors = []
        } = req.body;

        if (!title?.trim()) return errorResponse(res, 'Title is required.', 400);

        // Generate unique slug
        let baseSlug = slugify(title);
        let slug = baseSlug;
        let counter = 1;
        while (true) {
            const [existing] = await db.query('SELECT id FROM projects WHERE slug = ?', [slug]);
            if (existing.length === 0) break;
            slug = `${baseSlug}-${counter++}`;
        }

        const validImages = filterValidMediaUrls(Array.isArray(images) ? images : [], true);
        const validVideos = filterValidMediaUrls(Array.isArray(videos) ? videos : [], false);
        const seoImages = renameMediaToSeoFriendly(validImages, title);
        const imagesJson = JSON.stringify(Array.isArray(seoImages) ? seoImages : []);
        const videosJson = JSON.stringify(validVideos);
        const depsJson = JSON.stringify(Array.isArray(departments) ? departments : []);
        
        const adminId = req.admin ? req.admin.id : null;

        const cleanStartDate = sanitizeDate(start_date);
        const cleanEndDate = sanitizeDate(end_date);
        const cleanActualStartDate = sanitizeDate(actual_start_date);
        const cleanActualEndDate = sanitizeDate(actual_end_date);
        const cleanBudget = sanitizeNumber(budget, 0.00);
        const cleanSectorId = sanitizeId(sector_id);
        const cleanLocalBodyId = sanitizeId(local_body_id);
        const cleanWardId = sanitizeId(ward_id);
        const cleanDeptId = sanitizeId(department_id);
        const cleanYear = sanitizeId(year);
        const cleanDisplayOrder = sanitizeNumber(display_order, 0);
        const cleanIsActive = (is_active == 1 || is_active === true || is_active === '1') ? 1 : 0;
        const cleanProjectType = sanitizeProjectType(project_type);
        const cleanProjectSubType = project_sub_type ? String(project_sub_type).trim() : null;

        const [result] = await db.query(
            `INSERT INTO projects (title, slug, description, project_content, images, videos, tags, year, sector_id, category, local_body_id, display_order, is_active, status, ward_id, start_date, end_date, actual_start_date, actual_end_date, location, departments, department_id, budget, created_by, updated_by, project_type, project_sub_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title.trim(), slug, description || null, project_content || null, imagesJson, videosJson, tags || null, cleanYear,
            cleanSectorId, category || null, cleanLocalBodyId, cleanDisplayOrder, cleanIsActive,
            status || 'In Progress', cleanWardId, cleanStartDate, cleanEndDate, cleanActualStartDate, cleanActualEndDate, location || null, depsJson, cleanDeptId, cleanBudget, adminId, adminId, cleanProjectType, cleanProjectSubType]
        );

        const newProjectId = result.insertId;

        // Batch insert milestones if provided
        if (Array.isArray(milestones) && milestones.length > 0) {
            for (let i = 0; i < milestones.length; i++) {
                const m = milestones[i];
                if (m && m.title && m.title.trim()) {
                    await db.query(
                        `INSERT INTO project_milestones (project_id, title, status, target_date, display_order)
                         VALUES (?, ?, ?, ?, ?)`,
                        [newProjectId, m.title.trim(), m.status || 'Pending', sanitizeDate(m.target_date), i]
                    );
                }
            }
        }

        // Batch insert team members if provided
        if (Array.isArray(team) && team.length > 0) {
            for (const t of team) {
                const adminUserId = t.admin_user_id || (typeof t.id === 'number' ? t.id : null);
                if (adminUserId) {
                    await db.query(
                        `INSERT INTO project_team_members (project_id, admin_user_id, role_in_project)
                         VALUES (?, ?, ?)`,
                        [newProjectId, adminUserId, t.role_in_project || t.role_label || t.role || 'Member']
                    );
                }
            }
        }

        // Batch insert contractors if provided
        if (Array.isArray(contractors) && contractors.length > 0) {
            for (const c of contractors) {
                if (c && c.name && c.name.trim()) {
                    await db.query(
                        `INSERT INTO project_contractors (project_id, name, contact_person, role, phone, email, description)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            newProjectId,
                            c.name.trim(),
                            (c.contactPerson || c.contact_person || '').trim(),
                            (c.role || '').trim(),
                            (c.phone || '').trim(),
                            (c.email || '').trim(),
                            (c.description || '').trim()
                        ]
                    );
                }
            }
        }

        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, w.ward_no, w.place_name AS ward_name, p.images, p.videos
             FROM projects p
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             WHERE p.id = ?`, [newProjectId]
        );
        const p = rows[0];
        p.images = parseImages(p.images);
        p.videos = parseVideos(p.videos);
        p.departments = typeof p.departments === 'string' ? JSON.parse(p.departments) : (p.departments || []);
        
        return successResponse(res, { data: p }, 'Project created.', 201);
    } catch (err) {
        console.error('[createProject]', err);
        return errorResponse(res, 'Server error creating project.');
    }
};

// ── PUT /api/projects/:id  ─────────────────────────────────────
export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, project_content, images = [], videos = [], tags,
            year, sector_id, category, local_body_id,
            display_order = 0, is_active = 1,
            status = 'In Progress', ward_id, start_date, end_date,
            actual_start_date, actual_end_date, location, departments = [], department_id, budget = 0.00,
            project_type = 'MLA', project_sub_type
        } = req.body;

        if (!title?.trim()) return errorResponse(res, 'Title is required.', 400);

        // Generate unique slug if title changed
        const [[oldProj]] = await db.query('SELECT title, slug, images, videos FROM projects WHERE id = ?', [id]);
        if (!oldProj) return errorResponse(res, 'Project not found.', 404);

        let slug = oldProj.slug;
        if (title.trim() !== oldProj.title) {
            let baseSlug = slugify(title);
            slug = baseSlug;
            let counter = 1;
            while (true) {
                const [existing] = await db.query('SELECT id FROM projects WHERE slug = ? AND id != ?', [slug, id]);
                if (existing.length === 0) break;
                slug = `${baseSlug}-${counter++}`;
            }
        }

        const validImages = filterValidMediaUrls(Array.isArray(images) ? images : [], true);
        const validVideos = filterValidMediaUrls(Array.isArray(videos) ? videos : [], false);
        const seoImages = renameMediaToSeoFriendly(validImages, title);
        const imagesJson = JSON.stringify(Array.isArray(seoImages) ? seoImages : []);
        const videosJson = JSON.stringify(validVideos);
        const depsJson = JSON.stringify(Array.isArray(departments) ? departments : []);
        
        const adminId = req.admin ? req.admin.id : null;

        const cleanStartDate = sanitizeDate(start_date);
        const cleanEndDate = sanitizeDate(end_date);
        const cleanActualStartDate = sanitizeDate(actual_start_date);
        const cleanActualEndDate = sanitizeDate(actual_end_date);
        const cleanBudget = sanitizeNumber(budget, 0.00);
        const cleanSectorId = sanitizeId(sector_id);
        const cleanLocalBodyId = sanitizeId(local_body_id);
        const cleanWardId = sanitizeId(ward_id);
        const cleanDeptId = sanitizeId(department_id);
        const cleanYear = sanitizeId(year);
        const cleanDisplayOrder = sanitizeNumber(display_order, 0);
        const cleanIsActive = (is_active == 1 || is_active === true || is_active === '1') ? 1 : 0;
        const cleanProjectType = sanitizeProjectType(project_type);
        const cleanProjectSubType = project_sub_type ? String(project_sub_type).trim() : null;

        const [result] = await db.query(
            `UPDATE projects SET title=?, slug=?, description=?, project_content=?, images=?, videos=?, tags=?, year=?,
             sector_id=?, category=?, local_body_id=?, display_order=?, is_active=?, updated_at=NOW(), updated_by=?,
             status=?, ward_id=?, start_date=?, end_date=?, actual_start_date=?, actual_end_date=?, location=?, departments=?, department_id=?, budget=?, project_type=?, project_sub_type=?
             WHERE id=?`,
            [title.trim(), slug, description || null, project_content || null, imagesJson, videosJson, tags || null, cleanYear,
            cleanSectorId, category || null, cleanLocalBodyId, cleanDisplayOrder, cleanIsActive, adminId,
            status || 'In Progress', cleanWardId, cleanStartDate, cleanEndDate, cleanActualStartDate, cleanActualEndDate, location || null, depsJson, cleanDeptId, cleanBudget, cleanProjectType, cleanProjectSubType, id]
        );

        if (!result.affectedRows) return errorResponse(res, 'Project not found.', 404);
        const [rows] = await db.query(
            `SELECT p.*, s.name AS sector_name, lb.name AS local_body_name, w.ward_no, w.place_name AS ward_name, p.images, p.videos
             FROM projects p
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             WHERE p.id = ?`, [id]
        );
        const p = rows[0];
        p.images = parseImages(p.images);
        p.videos = parseVideos(p.videos);
        p.departments = typeof p.departments === 'string' ? JSON.parse(p.departments) : (p.departments || []);

        return successResponse(res, { data: p }, 'Project updated.');
    } catch (err) {
        console.error('[updateProject]', err);
        return errorResponse(res, 'Server error updating project.');
    }
};

// ── GET /api/projects/trash  (admin, paginated & filtered) ────
export const getTrashProjects = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 15);
        const offset = (page - 1) * limit;

        const {
            search = '',
            module = 'all',
            type = '',
            daysLeft = '',
            datePreset = '',
            startDate = '',
            endDate = '',
            localBody = '',
            ward = '',
            createdBy = '',
            deletedBy = '',
            sortBy = 'Expiring Soon'
        } = req.query;

        const conditions = ['p.is_deleted = 1'];
        const vals = [];

        // Search (by title, slug, PRJ-id, or user name)
        if (search && search.trim()) {
            const s = `%${search.trim()}%`;
            conditions.push('(p.title LIKE ? OR p.slug LIKE ? OR CONCAT("PRJ-", LPAD(p.id, 4, "0")) LIKE ? OR del_u.full_name LIKE ? OR cr_u.full_name LIKE ?)');
            vals.push(s, s, s, s, s);
        }

        // Module / Project Type Filter (All, MLA Projects, Other Projects)
        const effectiveMod = module !== 'all' ? module : (type && type !== 'all' ? type : '');
        if (effectiveMod === 'MLA Projects' || effectiveMod === 'MLA') {
            conditions.push("p.project_type = 'MLA'");
        } else if (effectiveMod === 'Other Projects' || effectiveMod === 'PORTFOLIO' || effectiveMod === 'other') {
            conditions.push("p.project_type != 'MLA'");
        }

        // Days Left Filter
        if (daysLeft) {
            const dList = daysLeft.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
            const orDays = [];
            dList.forEach(d => {
                if (d === 'critical') orDays.push('DATEDIFF(NOW(), p.deleted_at) >= 27'); // <= 3 days left out of 30
                else if (d === 'warning') orDays.push('(DATEDIFF(NOW(), p.deleted_at) >= 15 AND DATEDIFF(NOW(), p.deleted_at) < 27)'); // 4-15 days left
                else if (d === 'safe') orDays.push('DATEDIFF(NOW(), p.deleted_at) < 15'); // > 15 days left
            });
            if (orDays.length > 0) conditions.push(`(${orDays.join(' OR ')})`);
        }

        // Date Preset / Custom Range for deleted_at
        if (datePreset) {
            const preset = datePreset.trim();
            if (preset === 'Today') {
                conditions.push('DATE(p.deleted_at) = CURDATE()');
            } else if (preset === 'Yesterday') {
                conditions.push('DATE(p.deleted_at) = SUBDATE(CURDATE(), 1)');
            } else if (preset === 'Last 7 Days') {
                conditions.push('p.deleted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
            } else if (preset === 'Last 30 Days') {
                conditions.push('p.deleted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
            } else if (preset === 'This Month') {
                conditions.push('YEAR(p.deleted_at) = YEAR(CURDATE()) AND MONTH(p.deleted_at) = MONTH(CURDATE())');
            } else if (preset === 'This Year') {
                conditions.push('YEAR(p.deleted_at) = YEAR(CURDATE())');
            }
        } else {
            if (startDate) {
                conditions.push('DATE(p.deleted_at) >= ?');
                vals.push(startDate);
            }
            if (endDate) {
                conditions.push('DATE(p.deleted_at) <= ?');
                vals.push(endDate);
            }
        }

        // Local Body
        if (localBody) {
            const lbs = localBody.split(',').map(l => l.trim()).filter(Boolean);
            if (lbs.length > 0) {
                conditions.push(`(lb.name IN (${lbs.map(() => '?').join(',')}) OR p.local_body_id IN (${lbs.filter(v => !isNaN(v)).map(() => '?').join(',') || 'NULL'}))`);
                vals.push(...lbs, ...lbs.filter(v => !isNaN(v)));
            }
        }

        // Ward
        if (ward) {
            const wards = ward.split(',').map(w => w.trim()).filter(Boolean);
            if (wards.length > 0) {
                conditions.push(`(w.place_name IN (${wards.map(() => '?').join(',')}) OR CONCAT("Ward ", w.ward_no) IN (${wards.map(() => '?').join(',')}))`);
                vals.push(...wards, ...wards);
            }
        }

        // Created By
        if (createdBy) {
            const users = createdBy.split(',').map(u => u.trim()).filter(Boolean);
            if (users.length > 0) {
                conditions.push(`(cr_u.full_name IN (${users.map(() => '?').join(',')}) OR cr_u.email IN (${users.map(() => '?').join(',')}))`);
                vals.push(...users, ...users);
            }
        }

        // Deleted By
        if (deletedBy) {
            const users = deletedBy.split(',').map(u => u.trim()).filter(Boolean);
            if (users.length > 0) {
                conditions.push(`(del_u.full_name IN (${users.map(() => '?').join(',')}) OR del_u.email IN (${users.map(() => '?').join(',')}))`);
                vals.push(...users, ...users);
            }
        }

        // Sorting
        let orderClause = 'ORDER BY p.deleted_at ASC'; // default Expiring Soon
        switch (sortBy) {
            case 'Expiring Soon':
                orderClause = 'ORDER BY p.deleted_at ASC';
                break;
            case 'Expiring Last':
                orderClause = 'ORDER BY p.deleted_at DESC';
                break;
            case 'Title A–Z':
            case 'Title A-Z':
                orderClause = 'ORDER BY p.title ASC';
                break;
            case 'Title Z–A':
            case 'Title Z-A':
                orderClause = 'ORDER BY p.title DESC';
                break;
            case 'Recently Deleted':
                orderClause = 'ORDER BY p.deleted_at DESC';
                break;
            default:
                orderClause = 'ORDER BY p.deleted_at ASC';
        }

        const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total 
             FROM projects p 
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             LEFT JOIN admin_users cr_u ON cr_u.id = p.created_by
             LEFT JOIN admin_users del_u ON del_u.id = p.deleted_by
             ${whereSql}`, vals
        );

        const [rows] = await db.query(
            `SELECT p.id, p.title, p.slug, p.description, p.images, p.videos,
                    p.year, p.sector_id, p.category, p.local_body_id, p.ward_id,
                    p.status, p.project_type, p.project_sub_type,
                    p.created_at, p.updated_at, p.deleted_at,
                    s.name AS sector_name, lb.name AS local_body_name,
                    w.ward_no, w.place_name AS ward_name,
                    cr_u.full_name AS created_by_name,
                    del_u.full_name AS deleted_by_name
             FROM projects p
             LEFT JOIN sectors s ON s.id = p.sector_id
             LEFT JOIN local_bodies lb ON lb.id = p.local_body_id
             LEFT JOIN local_body_wards w ON w.id = p.ward_id
             LEFT JOIN admin_users cr_u ON cr_u.id = p.created_by
             LEFT JOIN admin_users del_u ON del_u.id = p.deleted_by
             ${whereSql}
             ${orderClause}
             LIMIT ? OFFSET ?`,
            [...vals, limit, offset]
        );

        const items = rows.map(r => {
            const deletedAtTime = r.deleted_at ? new Date(r.deleted_at).getTime() : Date.now();
            const daysSinceDeleted = Math.floor((Date.now() - deletedAtTime) / (1000 * 60 * 60 * 24));
            const daysLeft = Math.max(0, 30 - daysSinceDeleted);
            const expiresOnTime = new Date(deletedAtTime + 30 * 24 * 60 * 60 * 1000);

            return {
                id: `projects-${r.id}`,
                rawId: r.id,
                module: r.project_type === 'MLA' ? 'MLA Projects' : 'Other Projects',
                projectType: r.project_type,
                projectSubType: r.project_sub_type,
                displayId: `PRJ-${String(r.id).padStart(4, '0')}`,
                title: r.title || 'Untitled Project',
                daysLeft,
                expiresOn: expiresOnTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                deletedBy: r.deleted_by_name || 'Admin User',
                deletedOn: r.deleted_at ? `${new Date(r.deleted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date(r.deleted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—',
                deletedAt: r.deleted_at,
                sectorName: r.sector_name,
                localBodyName: r.local_body_name,
                wardName: r.ward_name,
                status: r.status,
            };
        });

        return successResponse(res, {
            data: items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit) || 1
            }
        }, 'Trash projects fetched.');
    } catch (err) {
        console.error('[getTrashProjects]', err);
        return errorResponse(res, 'Server error fetching trash projects.');
    }
};

// ── PATCH /api/projects/:id/trash  (soft-delete → trash) ───────
export const trashProject = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin ? req.admin.id : null;

        const [[proj]] = await db.query('SELECT id, title FROM projects WHERE id = ?', [id]);
        if (!proj) return errorResponse(res, 'Project not found.', 404);

        await db.query(
            'UPDATE projects SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
            [adminId, id]
        );

        return successResponse(res, { id }, `Project "${proj.title}" moved to trash.`);
    } catch (err) {
        console.error('[trashProject]', err);
        return errorResponse(res, 'Server error moving project to trash.');
    }
};

// ── PATCH /api/projects/:id/restore  (restore from trash) ──────
export const restoreProject = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'UPDATE projects SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ? AND is_deleted = 1',
            [id]
        );

        if (result.affectedRows === 0) return errorResponse(res, 'Trashed project not found.', 404);

        return successResponse(res, { id }, 'Project restored successfully.');
    } catch (err) {
        console.error('[restoreProject]', err);
        return errorResponse(res, 'Server error restoring project.');
    }
};

// ── DELETE /api/projects/:id/permanent  (force hard-delete) ─────
export const permanentDeleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT images, videos FROM projects WHERE id = ?', [id]);
        if (!rows.length) return errorResponse(res, 'Project not found.', 404);

        // Delete image & video files from disk
        parseImages(rows[0].images).forEach(deleteFile);
        parseVideos(rows[0].videos).forEach(deleteFile);

        await db.query('DELETE FROM projects WHERE id = ?', [id]);
        return successResponse(res, { id }, 'Project permanently deleted.');
    } catch (err) {
        console.error('[permanentDeleteProject]', err);
        return errorResponse(res, 'Server error permanently deleting project.');
    }
};

// ── POST /api/projects/trash/bulk-restore ──────────────────────
export const bulkRestoreProjects = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return errorResponse(res, 'ids array is required.', 400);
        }

        const numericIds = ids.map(id => typeof id === 'string' ? parseInt(id.replace(/[^0-9]/g, '')) : id).filter(Boolean);
        if (numericIds.length === 0) return errorResponse(res, 'No valid project IDs provided.', 400);

        const [result] = await db.query(
            `UPDATE projects SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id IN (${numericIds.map(() => '?').join(',')}) AND is_deleted = 1`,
            numericIds
        );

        return successResponse(res, { restoredCount: result.affectedRows }, `Restored ${result.affectedRows} project(s).`);
    } catch (err) {
        console.error('[bulkRestoreProjects]', err);
        return errorResponse(res, 'Server error bulk restoring projects.');
    }
};

// ── POST /api/projects/trash/bulk-delete ───────────────────────
export const bulkPermanentDeleteProjects = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return errorResponse(res, 'ids array is required.', 400);
        }

        const numericIds = ids.map(id => typeof id === 'string' ? parseInt(id.replace(/[^0-9]/g, '')) : id).filter(Boolean);
        if (numericIds.length === 0) return errorResponse(res, 'No valid project IDs provided.', 400);

        const [rows] = await db.query(
            `SELECT images, videos FROM projects WHERE id IN (${numericIds.map(() => '?').join(',')})`,
            numericIds
        );

        rows.forEach(r => {
            parseImages(r.images).forEach(deleteFile);
            parseVideos(r.videos).forEach(deleteFile);
        });

        const [result] = await db.query(
            `DELETE FROM projects WHERE id IN (${numericIds.map(() => '?').join(',')})`,
            numericIds
        );

        return successResponse(res, { deletedCount: result.affectedRows }, `Permanently deleted ${result.affectedRows} project(s).`);
    } catch (err) {
        console.error('[bulkPermanentDeleteProjects]', err);
        return errorResponse(res, 'Server error bulk permanently deleting projects.');
    }
};

// ── DELETE /api/projects/:id  (default to soft-delete) ─────────
export const deleteProject = async (req, res) => {
    return trashProject(req, res);
};
