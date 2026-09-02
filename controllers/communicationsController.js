import pool from '../configs/db.js';

/**
 * Unified Communications Controller
 *
 * Implements an industry-standard, server-side paginated & indexed aggregation engine
 * across all core modules (Complaints, Issues, Ideas, Suggestions, CM Fund Applications).
 */

export const getCommunications = async (req, res) => {
  try {
    const {
      tab = 'all',
      page = 1,
      limit = 10,
      search = '',
      search_field = 'all',
      searchField = 'all',
      local_body_id,
      localBody,
      ward_id,
      ward,
      startDate,
      endDate,
      modules = 'C-,P-,I-,S-,F-',
      sortBy = 'Newest First',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * pageSize;

    const activeModules = (typeof modules === 'string' ? modules.split(',') : modules)
      .map(m => m.trim())
      .filter(Boolean);

    const subQueries = [];
    const baseParams = [];

    // Common query builder helper
    const lbFilter = local_body_id || localBody;
    const wardFilter = ward_id || ward;
    const activeField = (search_field || searchField || 'all').toLowerCase();
    const cleanSearch = (search || '').trim();

    // 1. Complaints (C-)
    if (activeModules.includes('C-')) {
      subQueries.push(`
        SELECT 
          c.id AS _rawId,
          c.reference_no AS id,
          'C-' AS _module,
          'Complaint' AS _moduleName,
          c.title,
          c.complainant_name AS contactName,
          c.phone AS contactPhone,
          c.email AS contactEmail,
          c.location AS locationAddress,
          c.local_body_id AS localBodyId,
          lb.name AS localBody,
          c.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          c.status,
          c.created_at AS _createdAt,
          (SELECT COUNT(*) FROM complaint_updates WHERE complaint_id = c.id) AS _updatesCount,
          (SELECT JSON_OBJECT('id', id, 'type', type, 'title', title, 'created_at', DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z'))
           FROM complaint_updates WHERE complaint_id = c.id AND type != 'Communication' ORDER BY created_at DESC LIMIT 1) AS last_update,
          (SELECT JSON_OBJECT(
              'id', cl1.id,
              'channels', (
                  SELECT GROUP_CONCAT(DISTINCT cl2.channel)
                  FROM communications_logs cl2
                  WHERE cl2.entity_type COLLATE utf8mb4_unicode_ci = 'Complaint' 
                    AND (cl2.entity_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl2.entity_id COLLATE utf8mb4_unicode_ci = c.reference_no COLLATE utf8mb4_unicode_ci)
                    AND cl2.created_at >= cl1.created_at - INTERVAL 1 MINUTE
                    AND cl2.created_at <= cl1.created_at + INTERVAL 1 MINUTE
              ),
              'created_at', DATE_FORMAT(cl1.created_at, '%Y-%m-%dT%H:%i:%s.000Z')
           ) FROM communications_logs cl1 
             WHERE cl1.entity_type COLLATE utf8mb4_unicode_ci = 'Complaint' 
               AND (cl1.entity_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl1.entity_id COLLATE utf8mb4_unicode_ci = c.reference_no COLLATE utf8mb4_unicode_ci)
             ORDER BY cl1.created_at DESC LIMIT 1) AS last_communication,
          (SELECT JSON_OBJECT('scheduled_at', DATE_FORMAT(j.scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z'), 'channels', j.channels)
           FROM bulk_send_jobs j
           WHERE j.status = 'scheduled' AND JSON_CONTAINS(j.payload, JSON_OBJECT('id', c.id, 'module', 'C-'), '$.contacts') = 1
           ORDER BY j.scheduled_at ASC LIMIT 1) AS scheduled_communication
        FROM complaints c
        LEFT JOIN local_bodies lb ON c.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON c.ward_id = lbw.id
        WHERE c.is_deleted = 0
      `);
    }

    // 2. Public Issues (P-)
    if (activeModules.includes('P-')) {
      subQueries.push(`
        SELECT 
          i.id AS _rawId,
          i.reference_no AS id,
          'P-' AS _module,
          'Issue' AS _moduleName,
          i.title,
          i.submitter_name AS contactName,
          i.phone AS contactPhone,
          i.email AS contactEmail,
          i.location AS locationAddress,
          i.local_body_id AS localBodyId,
          lb.name AS localBody,
          i.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          i.status,
          i.created_at AS _createdAt,
          (SELECT COUNT(*) FROM issue_updates WHERE issue_id = i.id) AS _updatesCount,
          (SELECT JSON_OBJECT('id', id, 'type', type, 'title', title, 'created_at', DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z'))
           FROM issue_updates WHERE issue_id = i.id AND type != 'Communication' ORDER BY created_at DESC LIMIT 1) AS last_update,
          (SELECT JSON_OBJECT(
              'id', cl1.id,
              'channels', (
                  SELECT GROUP_CONCAT(DISTINCT cl2.channel)
                  FROM communications_logs cl2
                  WHERE cl2.entity_type COLLATE utf8mb4_unicode_ci = 'Issue' 
                    AND (cl2.entity_id COLLATE utf8mb4_unicode_ci = CAST(i.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl2.entity_id COLLATE utf8mb4_unicode_ci = i.reference_no COLLATE utf8mb4_unicode_ci)
                    AND cl2.created_at >= cl1.created_at - INTERVAL 1 MINUTE
                    AND cl2.created_at <= cl1.created_at + INTERVAL 1 MINUTE
              ),
              'created_at', DATE_FORMAT(cl1.created_at, '%Y-%m-%dT%H:%i:%s.000Z')
           ) FROM communications_logs cl1 
             WHERE cl1.entity_type COLLATE utf8mb4_unicode_ci = 'Issue' 
               AND (cl1.entity_id COLLATE utf8mb4_unicode_ci = CAST(i.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl1.entity_id COLLATE utf8mb4_unicode_ci = i.reference_no COLLATE utf8mb4_unicode_ci)
             ORDER BY cl1.created_at DESC LIMIT 1) AS last_communication,
          (SELECT JSON_OBJECT('scheduled_at', DATE_FORMAT(j.scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z'), 'channels', j.channels)
           FROM bulk_send_jobs j
           WHERE j.status = 'scheduled' AND JSON_CONTAINS(j.payload, JSON_OBJECT('id', i.id, 'module', 'P-'), '$.contacts') = 1
           ORDER BY j.scheduled_at ASC LIMIT 1) AS scheduled_communication
        FROM issues i
        LEFT JOIN local_bodies lb ON i.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON i.ward_id = lbw.id
        WHERE i.is_deleted = 0
      `);
    }

    // 3. Ideas (I-)
    if (activeModules.includes('I-')) {
      subQueries.push(`
        SELECT 
          id.id AS _rawId,
          id.reference_no AS id,
          'I-' AS _module,
          'Idea' AS _moduleName,
          id.title,
          id.complainant_name AS contactName,
          id.phone AS contactPhone,
          id.email AS contactEmail,
          id.location AS locationAddress,
          id.local_body_id AS localBodyId,
          lb.name AS localBody,
          id.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          id.status,
          id.created_at AS _createdAt,
          (SELECT COUNT(*) FROM idea_updates WHERE idea_id = id.id) AS _updatesCount,
          (SELECT JSON_OBJECT('id', id, 'type', type, 'title', title, 'created_at', DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z'))
           FROM idea_updates WHERE idea_id = id.id AND type != 'Communication' ORDER BY created_at DESC LIMIT 1) AS last_update,
          (SELECT JSON_OBJECT(
              'id', cl1.id,
              'channels', (
                  SELECT GROUP_CONCAT(DISTINCT cl2.channel)
                  FROM communications_logs cl2
                  WHERE cl2.entity_type COLLATE utf8mb4_unicode_ci = 'Idea' 
                    AND (cl2.entity_id COLLATE utf8mb4_unicode_ci = CAST(id.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl2.entity_id COLLATE utf8mb4_unicode_ci = id.reference_no COLLATE utf8mb4_unicode_ci)
                    AND cl2.created_at >= cl1.created_at - INTERVAL 1 MINUTE
                    AND cl2.created_at <= cl1.created_at + INTERVAL 1 MINUTE
              ),
              'created_at', DATE_FORMAT(cl1.created_at, '%Y-%m-%dT%H:%i:%s.000Z')
           ) FROM communications_logs cl1 
             WHERE cl1.entity_type COLLATE utf8mb4_unicode_ci = 'Idea' 
               AND (cl1.entity_id COLLATE utf8mb4_unicode_ci = CAST(id.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl1.entity_id COLLATE utf8mb4_unicode_ci = id.reference_no COLLATE utf8mb4_unicode_ci)
             ORDER BY cl1.created_at DESC LIMIT 1) AS last_communication,
          (SELECT JSON_OBJECT('scheduled_at', DATE_FORMAT(j.scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z'), 'channels', j.channels)
           FROM bulk_send_jobs j
           WHERE j.status = 'scheduled' AND JSON_CONTAINS(j.payload, JSON_OBJECT('id', id.id, 'module', 'I-'), '$.contacts') = 1
           ORDER BY j.scheduled_at ASC LIMIT 1) AS scheduled_communication
        FROM ideas id
        LEFT JOIN local_bodies lb ON id.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON id.ward_id = lbw.id
        WHERE id.is_deleted = 0
      `);
    }

    // 4. Suggestions (S-)
    if (activeModules.includes('S-')) {
      subQueries.push(`
        SELECT 
          s.id AS _rawId,
          s.reference_no AS id,
          'S-' AS _module,
          'Suggestion' AS _moduleName,
          s.title,
          s.complainant_name AS contactName,
          s.phone AS contactPhone,
          s.email AS contactEmail,
          s.location AS locationAddress,
          s.local_body_id AS localBodyId,
          lb.name AS localBody,
          s.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          s.status,
          s.created_at AS _createdAt,
          (SELECT COUNT(*) FROM suggestion_updates WHERE suggestion_id = s.id) AS _updatesCount,
          (SELECT JSON_OBJECT('id', id, 'type', type, 'title', title, 'created_at', DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z'))
           FROM suggestion_updates WHERE suggestion_id = s.id AND type != 'Communication' ORDER BY created_at DESC LIMIT 1) AS last_update,
          (SELECT JSON_OBJECT(
              'id', cl1.id,
              'channels', (
                  SELECT GROUP_CONCAT(DISTINCT cl2.channel)
                  FROM communications_logs cl2
                  WHERE cl2.entity_type COLLATE utf8mb4_unicode_ci = 'Suggestion' 
                    AND (cl2.entity_id COLLATE utf8mb4_unicode_ci = CAST(s.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl2.entity_id COLLATE utf8mb4_unicode_ci = s.reference_no COLLATE utf8mb4_unicode_ci)
                    AND cl2.created_at >= cl1.created_at - INTERVAL 1 MINUTE
                    AND cl2.created_at <= cl1.created_at + INTERVAL 1 MINUTE
              ),
              'created_at', DATE_FORMAT(cl1.created_at, '%Y-%m-%dT%H:%i:%s.000Z')
           ) FROM communications_logs cl1 
             WHERE cl1.entity_type COLLATE utf8mb4_unicode_ci = 'Suggestion' 
               AND (cl1.entity_id COLLATE utf8mb4_unicode_ci = CAST(s.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl1.entity_id COLLATE utf8mb4_unicode_ci = s.reference_no COLLATE utf8mb4_unicode_ci)
             ORDER BY cl1.created_at DESC LIMIT 1) AS last_communication,
          (SELECT JSON_OBJECT('scheduled_at', DATE_FORMAT(j.scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z'), 'channels', j.channels)
           FROM bulk_send_jobs j
           WHERE j.status = 'scheduled' AND JSON_CONTAINS(j.payload, JSON_OBJECT('id', s.id, 'module', 'S-'), '$.contacts') = 1
           ORDER BY j.scheduled_at ASC LIMIT 1) AS scheduled_communication
        FROM suggestions s
        LEFT JOIN local_bodies lb ON s.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON s.ward_id = lbw.id
        WHERE s.is_deleted = 0
      `);
    }

    // 5. CM Fund Requests / Applications (F-)
    if (activeModules.includes('F-')) {
      subQueries.push(`
        SELECT 
          f.id AS _rawId,
          f.id AS id,
          'F-' AS _module,
          'Application' AS _moduleName,
          f.application_title AS title,
          f.applicant_name AS contactName,
          f.applicant_phone AS contactPhone,
          NULL AS contactEmail,
          COALESCE(f.address_line1, f.address, f.location) AS locationAddress,
          f.local_body_id AS localBodyId,
          lb.name AS localBody,
          f.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          f.status,
          f.created_at AS _createdAt,
          (SELECT COUNT(*) FROM cm_fund_updates WHERE request_id = f.id) AS _updatesCount,
          (SELECT JSON_OBJECT('id', id, 'type', type, 'title', title, 'created_at', DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s.000Z'))
           FROM cm_fund_updates WHERE request_id = f.id AND type != 'Communication' ORDER BY created_at DESC LIMIT 1) AS last_update,
          (SELECT JSON_OBJECT(
              'id', cl1.id,
              'channels', (
                  SELECT GROUP_CONCAT(DISTINCT cl2.channel)
                  FROM communications_logs cl2
                  WHERE cl2.entity_type COLLATE utf8mb4_unicode_ci = 'Application' 
                    AND (cl2.entity_id COLLATE utf8mb4_unicode_ci = CAST(f.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl2.entity_id COLLATE utf8mb4_unicode_ci = CONCAT('A-', f.id) COLLATE utf8mb4_unicode_ci OR cl2.entity_id COLLATE utf8mb4_unicode_ci = CONCAT('CM-', f.id) COLLATE utf8mb4_unicode_ci)
                    AND cl2.created_at >= cl1.created_at - INTERVAL 1 MINUTE
                    AND cl2.created_at <= cl1.created_at + INTERVAL 1 MINUTE
              ),
              'created_at', DATE_FORMAT(cl1.created_at, '%Y-%m-%dT%H:%i:%s.000Z')
           ) FROM communications_logs cl1 
             WHERE cl1.entity_type COLLATE utf8mb4_unicode_ci = 'Application' 
               AND (cl1.entity_id COLLATE utf8mb4_unicode_ci = CAST(f.id AS CHAR) COLLATE utf8mb4_unicode_ci OR cl1.entity_id COLLATE utf8mb4_unicode_ci = CONCAT('A-', f.id) COLLATE utf8mb4_unicode_ci OR cl1.entity_id COLLATE utf8mb4_unicode_ci = CONCAT('CM-', f.id) COLLATE utf8mb4_unicode_ci)
             ORDER BY cl1.created_at DESC LIMIT 1) AS last_communication,
          (SELECT JSON_OBJECT('scheduled_at', DATE_FORMAT(j.scheduled_at, '%Y-%m-%dT%H:%i:%s.000Z'), 'channels', j.channels)
           FROM bulk_send_jobs j
           WHERE j.status = 'scheduled' AND JSON_CONTAINS(j.payload, JSON_OBJECT('id', f.id, 'module', 'F-'), '$.contacts') = 1
           ORDER BY j.scheduled_at ASC LIMIT 1) AS scheduled_communication
        FROM cm_fund_requests f
        LEFT JOIN local_bodies lb ON f.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON f.ward_id = lbw.id
        WHERE f.is_deleted = 0
      `);
    }

    if (subQueries.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page: pageNum, limit: pageSize, total: 0, totalPages: 0 },
        counts: { all: 0, sms: 0, email: 0 },
      });
    }

    const unionSql = `(${subQueries.join(' UNION ALL ')}) AS u`;

    // ── Apply WHERE conditions on unified dataset ──
    const conditions = [];
    const params = [];

    // Geo filters
    if (lbFilter) {
      conditions.push('u.localBodyId = ?');
      params.push(lbFilter);
    }
    if (wardFilter) {
      conditions.push('u.wardId = ?');
      params.push(wardFilter);
    }

    // Date filters
    if (startDate) {
      conditions.push('DATE(u._createdAt) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('DATE(u._createdAt) <= ?');
      params.push(endDate);
    }

    // Scoped search filter
    if (cleanSearch) {
      switch (activeField) {
        case 'id':
          conditions.push('(u.id = ? OR u.id LIKE ?)');
          params.push(cleanSearch, `${cleanSearch}%`);
          break;
        case 'phone':
        case 'number':
          const cleanPhone = cleanSearch.replace(/[^0-9]/g, '');
          conditions.push('u.contactPhone LIKE ?');
          params.push(`%${cleanPhone || cleanSearch}%`);
          break;
        case 'email':
          conditions.push('u.contactEmail LIKE ?');
          params.push(`%${cleanSearch}%`);
          break;
        case 'name':
          conditions.push('u.contactName LIKE ?');
          params.push(`%${cleanSearch}%`);
          break;
        case 'house_name':
        case 'address':
        case 'location':
          conditions.push('u.locationAddress LIKE ?');
          params.push(`%${cleanSearch}%`);
          break;
        case 'all':
        default:
          conditions.push('(u.title LIKE ? OR u.contactName LIKE ? OR u.id LIKE ? OR u.contactPhone LIKE ? OR u.contactEmail LIKE ? OR u.locationAddress LIKE ?)');
          const wildcard = `%${cleanSearch}%`;
          params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
          break;
      }
    }

    const baseWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ── Tab-specific filtering ──
    // All tab: strictly BOTH phone and email
    // SMS tab: strictly phone only (no email)
    // Email tab: strictly email only (no phone)
    let tabWhere = '';
    if (tab === 'sms') {
      tabWhere = "(u.contactPhone IS NOT NULL AND u.contactPhone != '' AND (u.contactEmail IS NULL OR u.contactEmail = ''))";
    } else if (tab === 'email') {
      tabWhere = "(u.contactEmail IS NOT NULL AND u.contactEmail != '' AND (u.contactPhone IS NULL OR u.contactPhone = ''))";
    } else {
      // 'all'
      tabWhere = "(u.contactPhone IS NOT NULL AND u.contactPhone != '' AND u.contactEmail IS NOT NULL AND u.contactEmail != '')";
    }

    const fullWhere = baseWhere ? `${baseWhere} AND ${tabWhere}` : `WHERE ${tabWhere}`;

    // ── Count total for current tab ──
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ${unionSql} ${fullWhere}`,
      params
    );

    // ── Calculate counts for all 3 tabs in parallel for badges ──
    const countAllWhere = baseWhere ? `${baseWhere} AND (u.contactPhone IS NOT NULL AND u.contactPhone != '' AND u.contactEmail IS NOT NULL AND u.contactEmail != '')` : `WHERE (u.contactPhone IS NOT NULL AND u.contactPhone != '' AND u.contactEmail IS NOT NULL AND u.contactEmail != '')`;
    const countSmsWhere = baseWhere ? `${baseWhere} AND (u.contactPhone IS NOT NULL AND u.contactPhone != '' AND (u.contactEmail IS NULL OR u.contactEmail = ''))` : `WHERE (u.contactPhone IS NOT NULL AND u.contactPhone != '' AND (u.contactEmail IS NULL OR u.contactEmail = ''))`;
    const countEmailWhere = baseWhere ? `${baseWhere} AND (u.contactEmail IS NOT NULL AND u.contactEmail != '' AND (u.contactPhone IS NULL OR u.contactPhone = ''))` : `WHERE (u.contactEmail IS NOT NULL AND u.contactEmail != '' AND (u.contactPhone IS NULL OR u.contactPhone = ''))`;

    const [[{ countAll }], [{ countSms }], [{ countEmail }]] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS countAll FROM ${unionSql} ${countAllWhere}`, params).then(([r]) => r),
      pool.query(`SELECT COUNT(*) AS countSms FROM ${unionSql} ${countSmsWhere}`, params).then(([r]) => r),
      pool.query(`SELECT COUNT(*) AS countEmail FROM ${unionSql} ${countEmailWhere}`, params).then(([r]) => r),
    ]);

    // ── Sorting ──
    let orderClause = 'ORDER BY u._createdAt DESC';
    if (sortBy === 'Oldest First') {
      orderClause = 'ORDER BY u._createdAt ASC';
    } else if (sortBy === 'Most Active') {
      orderClause = 'ORDER BY u._updatesCount DESC, u._createdAt DESC';
    }

    // ── Fetch paginated rows ──
    const querySql = `
      SELECT * FROM ${unionSql}
      ${fullWhere}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(querySql, [...params, pageSize, offset]);

    // ── Format rows for frontend compatibility ──
    const formattedData = rows.map(r => {
      let lastUpdate = null;
      if (r.last_update) {
        try {
          lastUpdate = typeof r.last_update === 'string' ? JSON.parse(r.last_update) : r.last_update;
        } catch (e) {}
      }

      let lastComm = null;
      if (r.last_communication) {
        try {
          lastComm = typeof r.last_communication === 'string' ? JSON.parse(r.last_communication) : r.last_communication;
        } catch (e) {}
      }

      let scheduledComm = null;
      if (r.scheduled_communication) {
        try {
          scheduledComm = typeof r.scheduled_communication === 'string' ? JSON.parse(r.scheduled_communication) : r.scheduled_communication;
        } catch (e) {}
      }

      const parseUTC = (dateStr) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
          return new Date(dateStr.replace(' ', 'T') + 'Z');
        }
        return new Date(dateStr);
      };

      const lastCommDateObj = lastComm?.created_at ? parseUTC(lastComm.created_at) : null;
      const lastCommunicationTypes = lastComm?.channels
        ? String(lastComm.channels).split(',').map(s => s.trim()).filter(Boolean)
        : (lastComm?.channel ? [String(lastComm.channel).trim()] : []);

      const schDateObj = scheduledComm?.scheduled_at ? parseUTC(scheduledComm.scheduled_at) : null;
      const schTypes = scheduledComm?.channels
        ? (typeof scheduledComm.channels === 'string' ? JSON.parse(scheduledComm.channels) : scheduledComm.channels)
        : {};
      const schMappedTypes = Object.entries(schTypes)
        .filter(([_, v]) => v)
        .map(([k]) => k.toLowerCase() === 'sms' ? 'SMS' : k.toLowerCase() === 'email' ? 'Email' : null)
        .filter(Boolean);

      return {
        id: r.id,
        _rawId: r._rawId,
        _module: r._module,
        _moduleName: r._moduleName,
        title: r.title || '—',
        contactName: r.contactName || '—',
        contactPhone: r.contactPhone || '',
        contactEmail: r.contactEmail || '',
        localBody: r.localBody || '—',
        wardNum: r.wardNum || '',
        wardName: r.wardName || '',
        status: r.status || '—',
        statusText: lastUpdate?.title || 'We are reviewing your submission.',
        lastCommunicationDate: lastCommDateObj ? lastCommDateObj.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : null,
        lastCommunicationTime: lastCommDateObj ? lastCommDateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : null,
        lastCommunicationTypes,
        scheduledDate: schDateObj ? schDateObj.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : null,
        scheduledTime: schDateObj ? schDateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : null,
        scheduledTypes: schMappedTypes,
        last_communication: lastComm,
        last_update: lastUpdate,
        scheduled_communication: scheduledComm,
        _createdAt: r._createdAt,
        _updatesCount: r._updatesCount || 0,
      };
    });

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      counts: {
        all: countAll || 0,
        sms: countSms || 0,
        email: countEmail || 0,
      },
    });
  } catch (err) {
    console.error('[getCommunications]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch communications.' });
  }
};
