import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_SORT = new Set([
    'newest', 'oldest',
    'user_asc', 'user_desc',
    'module_asc', 'module_desc',
    'action_asc', 'action_desc',
]);

const SORT_SQL = {
    newest:      'al.created_at DESC',
    oldest:      'al.created_at ASC',
    user_asc:    'au.full_name ASC',
    user_desc:   'au.full_name DESC',
    module_asc:  'al.module ASC',
    module_desc: 'al.module DESC',
    action_asc:  'al.action ASC',
    action_desc: 'al.action DESC',
};

const MAX_EXPORT_ROWS = 10_000;

// ─── Internal Helper: logActivity ─────────────────────────────────────────────

/**
 * Write an audit log entry.  Import and call this from other controllers.
 *
 * @param {import('express').Request|null} req  — pass null for system/job events
 * @param {{ action: string, module: string, details: string, resource?: string, severity?: string }} opts
 * @returns {Promise<number>} inserted row id
 */
/**
 * Extract the real client IP, handling:
 *  - X-Forwarded-For header (nginx / AWS ALB / Cloudflare)
 *  - X-Real-IP header (nginx)
 *  - req.ip  (Express — may be ::ffff:x.x.x.x in IPv6 dual-stack mode)
 *  - IPv6 loopback ::1 → normalised to 127.0.0.1
 */
const extractIp = (req) => {
    if (!req) return '127.0.0.1';

    // 1. X-Forwarded-For: may contain a comma-separated chain, take the first (client) IP
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
        const first = forwarded.split(',')[0].trim();
        if (first) return first.replace(/^::ffff:/, '');
    }

    // 2. X-Real-IP (set by some nginx configs)
    const realIp = req.headers?.['x-real-ip'];
    if (realIp) return realIp.trim().replace(/^::ffff:/, '');

    // 3. req.ip — strip IPv6-mapped IPv4 prefix and normalise ::1
    const raw = req.ip ?? '127.0.0.1';
    if (raw === '::1') return '127.0.0.1';
    return raw.replace(/^::ffff:/, '');
};

export const logActivity = async (req, { action, module, details, resource = null, severity = 'info' }) => {
    try {
        const adminUserId = req?.admin?.id ?? null;
        const ip          = extractIp(req);
        const userAgent   = req?.headers?.['user-agent'] ?? 'System';

        const [result] = await db.query(
            `INSERT INTO admin_activity_logs
             (admin_user_id, action, module, details, severity, ip_address, user_agent, resource)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [adminUserId, action, module, details, severity, ip, userAgent, resource]
        );
        return result.insertId;
    } catch (err) {
        // Never let logging crash the calling controller
        console.error('[logActivity] Failed to write audit log:', err.message);
        return null;
    }
};

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * Build parameterised WHERE conditions from query params.
 * Returns { conditions: string[], params: any[] }
 */
function buildWhere({ search, module, action, user }) {
    const conditions = [];
    const params = [];

    if (search?.trim()) {
        const q = `%${search.trim()}%`;
        conditions.push('(au.full_name LIKE ? OR al.action LIKE ? OR al.module LIKE ? OR al.details LIKE ? OR al.ip_address LIKE ?)');
        params.push(q, q, q, q, q);
    }

    if (module) {
        const modules = module.split(',').map(m => m.trim()).filter(Boolean);
        if (modules.length) {
            conditions.push(`al.module IN (${modules.map(() => '?').join(',')})`);
            params.push(...modules);
        }
    }

    if (action) {
        const actions = action.split(',').map(a => a.trim()).filter(Boolean);
        if (actions.length) {
            conditions.push(`al.action IN (${actions.map(() => '?').join(',')})`);
            params.push(...actions);
        }
    }

    if (user) {
        const users = user.split(',').map(u => u.trim()).filter(Boolean);
        if (users.length) {
            conditions.push(`au.full_name IN (${users.map(() => '?').join(',')})`);
            params.push(...users);
        }
    }

    return { conditions, params };
}

/**
 * Map a row from DB to the frontend entry shape.
 */
function mapRow(row) {
    return {
        id:        row.id,
        timestamp: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
        user:      row.full_name ?? 'System',
        userId:    row.user_code ?? `SYS${String(row.admin_user_id ?? '000').padStart(3, '0')}`,
        action:    row.action,
        module:    row.module,
        details:   row.details,
        severity:  row.severity,
        ip:        row.ip_address ?? '',
        userAgent: row.user_agent ?? 'System',
        resource:  row.resource ?? '',
    };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/teams-log
 * Query, filter, sort, paginate.
 */
export const getTeamsLog = async (req, res) => {
    try {
        // ── Parse & validate params ──────────────────────────────────────────
        let page  = parseInt(req.query.page, 10)  || 1;
        let limit = parseInt(req.query.limit, 10) || 15;
        if (page  < 1)   page  = 1;
        if (limit < 1)   limit = 1;
        if (limit > 100) limit = 100;

        const sort = ALLOWED_SORT.has(req.query.sort) ? req.query.sort : 'newest';
        const { search, module, action, user } = req.query;

        // ── Build WHERE ───────────────────────────────────────────────────────
        const { conditions, params } = buildWhere({ search, module, action, user });
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // ── Base JOIN query ───────────────────────────────────────────────────
        const baseQuery = `
            FROM admin_activity_logs al
            LEFT JOIN admin_users au ON al.admin_user_id = au.id
            ${whereClause}
        `;

        // ── Total count ───────────────────────────────────────────────────────
        const [[{ total }]] = await db.query(
            `SELECT COUNT(*) AS total ${baseQuery}`,
            params
        );

        // ── Module counts (full table, unfiltered — for tab badges) ───────────
        const [moduleRows] = await db.query(`
            SELECT module, COUNT(*) AS cnt
            FROM admin_activity_logs
            GROUP BY module
        `);
        const [[{ allCount }]] = await db.query('SELECT COUNT(*) AS allCount FROM admin_activity_logs');

        const moduleCounts = { All: Number(allCount) };
        moduleRows.forEach(r => { moduleCounts[r.module] = Number(r.cnt); });

        // ── Paginated entries ─────────────────────────────────────────────────
        const offset = (page - 1) * limit;
        const [rows] = await db.query(
            `SELECT al.*, au.full_name, au.user_code
             ${baseQuery}
             ORDER BY ${SORT_SQL[sort]}
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return successResponse(res, {
            data: {
                entries:      rows.map(mapRow),
                total:        Number(total),
                page,
                totalPages:   Math.ceil(Number(total) / limit),
                moduleCounts,
            },
        }, 'Teams log fetched successfully.');
    } catch (err) {
        console.error('[teamsLogController.getTeamsLog]', err);
        return errorResponse(res, 'Failed to fetch teams log.', 500);
    }
};

/**
 * GET /api/admin/teams-log/meta
 * Returns distinct users/modules/actions that have log entries.
 */
export const getTeamsLogMeta = async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT DISTINCT au.id, au.full_name, au.user_code
            FROM admin_users au
            INNER JOIN admin_activity_logs al ON al.admin_user_id = au.id
            ORDER BY au.full_name ASC
        `);

        const [modules] = await db.query(`
            SELECT DISTINCT module FROM admin_activity_logs ORDER BY module ASC
        `);

        const [actions] = await db.query(`
            SELECT DISTINCT action FROM admin_activity_logs ORDER BY action ASC
        `);

        return successResponse(res, {
            data: {
                users:       users.map(u => ({ id: u.id, full_name: u.full_name, user_code: u.user_code })),
                modules:     modules.map(r => r.module),
                actionTypes: actions.map(r => r.action),
            },
        }, 'Teams log meta fetched.');
    } catch (err) {
        console.error('[teamsLogController.getTeamsLogMeta]', err);
        return errorResponse(res, 'Failed to fetch teams log meta.', 500);
    }
};

/**
 * GET /api/admin/teams-log/export
 * Stream a filtered CSV (respects same filters as getTeamsLog, no pagination).
 */
export const exportTeamsLog = async (req, res) => {
    try {
        const sort = ALLOWED_SORT.has(req.query.sort) ? req.query.sort : 'newest';
        const { search, module, action, user } = req.query;

        const { conditions, params } = buildWhere({ search, module, action, user });
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [rows] = await db.query(
            `SELECT al.*, au.full_name, au.user_code
             FROM admin_activity_logs al
             LEFT JOIN admin_users au ON al.admin_user_id = au.id
             ${whereClause}
             ORDER BY ${SORT_SQL[sort]}
             LIMIT ?`,
            [...params, MAX_EXPORT_ROWS]
        );

        const today = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="teams-log-${today}.csv"`);

        // UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        const headers = ['ID', 'Timestamp', 'User', 'User ID', 'Action', 'Module', 'Details', 'Severity', 'IP Address', 'User Agent', 'Resource'];

        const escapeCSV = (val) => {
            const str = val == null ? '' : String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const csvRows = rows.map(row => {
            const entry = mapRow(row);
            return [
                entry.id,
                entry.timestamp,
                entry.user,
                entry.userId,
                entry.action,
                entry.module,
                entry.details,
                entry.severity,
                entry.ip,
                entry.userAgent,
                entry.resource,
            ].map(escapeCSV).join(',');
        });

        const csv = BOM + [headers.join(','), ...csvRows].join('\n');
        return res.send(csv);
    } catch (err) {
        console.error('[teamsLogController.exportTeamsLog]', err);
        return errorResponse(res, 'Failed to export teams log.', 500);
    }
};

/**
 * GET /api/admin/teams-log/:id
 * Return a single log entry (full detail).
 */
export const getTeamsLogEntry = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id || id < 1) {
            return errorResponse(res, 'Invalid log entry id.', 400);
        }

        const [rows] = await db.query(
            `SELECT al.*, au.full_name, au.user_code
             FROM admin_activity_logs al
             LEFT JOIN admin_users au ON al.admin_user_id = au.id
             WHERE al.id = ?`,
            [id]
        );

        if (!rows.length) {
            return errorResponse(res, 'Log entry not found.', 404);
        }

        return successResponse(res, { data: mapRow(rows[0]) }, 'Log entry fetched.');
    } catch (err) {
        console.error('[teamsLogController.getTeamsLogEntry]', err);
        return errorResponse(res, 'Failed to fetch log entry.', 500);
    }
};
