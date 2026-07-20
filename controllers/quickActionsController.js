import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const getUnifiedItems = async (req, res) => {
    try {
        const {
            type = 'draft', // 'draft' or 'trash'
            page = 1,
            limit = 10,
            search = '',
            module = 'all',
            priority = '',
            daysLeft = '', // comma-separated: 'critical,warning,safe'
            sortBy = '', // 'Most Recent', 'Least Recent', 'Title A-Z', 'Title Z-A', 'Expiring Soon', 'Expiring Last', 'Recently Deleted'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const parsedLimit = parseInt(limit);
        
        let statusFilter = '';
        if (type === 'draft') {
            statusFilter = "status = 'Draft' AND is_deleted = 0";
        } else if (type === 'trash') {
            statusFilter = "is_deleted = 1";
        } else {
            return errorResponse(res, "Invalid type. Must be 'draft' or 'trash'.", 400);
        }

        const lettersStatusFilter = type === 'draft' ? "status = 'Draft' AND trashed_at IS NULL" : "trashed_at IS NOT NULL";
        
        // Base Union Query mapping disparate tables to unified schema
        const baseQuery = `
            SELECT 
                c.id AS raw_id,
                CONCAT('C-', c.id) AS display_id,
                'Complaints' AS module,
                c.title AS title,
                lb.name AS local_body_name,
                w.place_name AS ward_name,
                c.priority AS priority,
                c.status AS status,
                c.created_at AS created_at,
                c.updated_at AS updated_at,
                c.deleted_at AS deleted_at,
                u.full_name AS created_by,
                del_u.full_name AS deleted_by
            FROM complaints c
            LEFT JOIN local_bodies lb ON c.local_body_id = lb.id
            LEFT JOIN local_body_wards w ON c.ward_id = w.id
            LEFT JOIN admin_users u ON c.filed_by_admin_id = u.id
            LEFT JOIN admin_users del_u ON c.updated_by_admin_id = del_u.id 
            WHERE c.${statusFilter}
            
            UNION ALL
            
            SELECT 
                i.id AS raw_id,
                CONCAT('I-', i.id) AS display_id,
                'Public Issue' AS module,
                i.title AS title,
                lb.name AS local_body_name,
                w.place_name AS ward_name,
                i.priority AS priority,
                i.status AS status,
                i.created_at AS created_at,
                i.updated_at AS updated_at,
                i.deleted_at AS deleted_at,
                u.full_name AS created_by,
                del_u.full_name AS deleted_by
            FROM issues i
            LEFT JOIN local_bodies lb ON i.local_body_id = lb.id
            LEFT JOIN local_body_wards w ON i.ward_id = w.id
            LEFT JOIN admin_users u ON i.filed_by_admin_id = u.id
            LEFT JOIN admin_users del_u ON i.updated_by_admin_id = del_u.id
            WHERE i.${statusFilter}
            
            UNION ALL
            
            SELECT 
                f.id AS raw_id,
                CAST(f.id AS CHAR) AS display_id,
                'Applications' AS module,
                IFNULL(f.applicant_name, 'Untitled Application') AS title,
                lb.name AS local_body_name,
                w.place_name AS ward_name,
                f.priority AS priority,
                f.status AS status,
                f.created_at AS created_at,
                f.updated_at AS updated_at,
                f.deleted_at AS deleted_at,
                u.full_name AS created_by,
                del_u.full_name AS deleted_by
            FROM cm_fund_requests f
            LEFT JOIN local_bodies lb ON f.local_body_id = lb.id
            LEFT JOIN local_body_wards w ON f.ward_id = w.id
            LEFT JOIN admin_users u ON f.submitted_by_id = u.id
            LEFT JOIN admin_users del_u ON f.deleted_by_id = del_u.id
            WHERE f.${statusFilter}
            
            UNION ALL
            
            SELECT 
                l.id AS raw_id,
                IFNULL(l.letter_id COLLATE utf8mb4_unicode_ci, CONCAT('L-', l.id)) AS display_id,
                'Letters' AS module,
                l.subject AS title,
                NULL AS local_body_name,
                NULL AS ward_name,
                l.priority AS priority,
                l.status AS status,
                l.created_at AS created_at,
                l.updated_at AS updated_at,
                l.trashed_at AS deleted_at,
                u.full_name AS created_by,
                del_u.full_name AS deleted_by
            FROM mla_letters l
            LEFT JOIN admin_users u ON l.prepared_by_user_id = u.id
            LEFT JOIN admin_users del_u ON l.trashed_by_id = del_u.id
            WHERE l.${lettersStatusFilter}
            
            UNION ALL
            
            SELECT 
                g.id AS raw_id,
                IF(g.governing_body_type COLLATE utf8mb4_unicode_ci ='OTHER', CONCAT('O-', g.id), CONCAT('M-', g.id)) AS display_id,
                IF(g.governing_body_type COLLATE utf8mb4_unicode_ci ='OTHER', 'Office', 'Governing Body') AS module,
                g.name AS title,
                lb.name AS local_body_name,
                w.place_name AS ward_name,
                'Normal' AS priority,
                g.status AS status,
                g.created_at AS created_at,
                g.updated_at AS updated_at,
                g.deleted_at AS deleted_at,
                NULL AS created_by,
                NULL AS deleted_by
            FROM governing_representatives g
            LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
            LEFT JOIN local_body_wards w ON g.ward_id = w.id
            WHERE g.${statusFilter}
        `;

        // Wrap the union in a subquery to apply global filters/sort
        let outerQuery = `SELECT *, 
            GREATEST(0, CEIL((UNIX_TIMESTAMP(DATE_ADD(deleted_at, INTERVAL 30 DAY)) - UNIX_TIMESTAMP(NOW())) / 86400)) AS daysLeft
            FROM (${baseQuery}) AS unified WHERE 1=1`;
        
        const params = [];

        if (module && module !== 'all') {
            outerQuery += ` AND module = ?`;
            params.push(module);
        }

        if (priority) {
            const pArray = priority.split(',').map(p => p.trim());
            const placeholders = pArray.map(() => '?').join(',');
            outerQuery += ` AND priority IN (${placeholders})`;
            params.push(...pArray);
        }

        if (search) {
            const searchPattern = `%${search}%`;
            outerQuery += ` AND (title LIKE ? OR display_id LIKE ? OR created_by LIKE ? OR deleted_by LIKE ?)`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (type === 'trash' && daysLeft) {
            const dlArray = daysLeft.split(',').map(d => d.trim());
            const conditions = [];
            if (dlArray.includes('critical')) conditions.push(`GREATEST(0, CEIL((UNIX_TIMESTAMP(DATE_ADD(deleted_at, INTERVAL 30 DAY)) - UNIX_TIMESTAMP(NOW())) / 86400)) <= 3`);
            if (dlArray.includes('warning')) conditions.push(`(GREATEST(0, CEIL((UNIX_TIMESTAMP(DATE_ADD(deleted_at, INTERVAL 30 DAY)) - UNIX_TIMESTAMP(NOW())) / 86400)) >= 4 AND GREATEST(0, CEIL((UNIX_TIMESTAMP(DATE_ADD(deleted_at, INTERVAL 30 DAY)) - UNIX_TIMESTAMP(NOW())) / 86400)) <= 15)`);
            if (dlArray.includes('safe')) conditions.push(`GREATEST(0, CEIL((UNIX_TIMESTAMP(DATE_ADD(deleted_at, INTERVAL 30 DAY)) - UNIX_TIMESTAMP(NOW())) / 86400)) > 15`);
            
            if (conditions.length > 0) {
                outerQuery += ` AND (${conditions.join(' OR ')})`;
            }
        }

        // Count Query
        const countQuery = `SELECT COUNT(*) AS total FROM (${outerQuery}) AS filteredCount`;
        const [[{ total }]] = await db.query(countQuery, params);

        // Sorting
        let orderByClause = '';
        if (sortBy === 'Most Recent') orderByClause = 'ORDER BY created_at DESC';
        else if (sortBy === 'Least Recent') orderByClause = 'ORDER BY created_at ASC';
        else if (sortBy === 'Title A–Z' || sortBy === 'Title A-Z') orderByClause = 'ORDER BY title ASC';
        else if (sortBy === 'Title Z–A' || sortBy === 'Title Z-A') orderByClause = 'ORDER BY title DESC';
        else if (sortBy === 'Expiring Soon') orderByClause = 'ORDER BY daysLeft ASC, deleted_at ASC';
        else if (sortBy === 'Expiring Last') orderByClause = 'ORDER BY daysLeft DESC, deleted_at DESC';
        else if (sortBy === 'Recently Deleted') orderByClause = 'ORDER BY deleted_at DESC';
        else {
            if (type === 'draft') orderByClause = 'ORDER BY created_at DESC';
            else orderByClause = 'ORDER BY daysLeft ASC, deleted_at ASC';
        }

        outerQuery += ` ${orderByClause} LIMIT ? OFFSET ?`;
        params.push(parsedLimit, offset);

        const [rows] = await db.query(outerQuery, params);

        return successResponse(res, {
            data: rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parsedLimit,
                totalPages: Math.ceil(total / parsedLimit)
            }
        });
    } catch (error) {
        console.error('[Unified Quick Actions Error]', error);
        return errorResponse(res, "Failed to retrieve unified items.");
    }
};
