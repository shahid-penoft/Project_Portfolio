import pool from '../configs/db.js';

/**
 * Global Tracking & Search Controller
 *
 * Implements an industry-standard, server-side indexed search engine
 * across all core modules (Complaints, Issues, Ideas, Suggestions, CM Fund Requests)
 * with support for scoped search, geographic, demographic, status, and date filters.
 */

export const getTrackingRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      search_field = 'all',
      searchField = 'all',
      modules = 'C-,P-,I-,S-,F-',
      local_body_id,
      localBody,
      ward_id,
      ward,
      status,
      gender,
      age_group,
      start_date,
      end_date,
      fromDate,
      toDate,
      sort_by = 'Newest First',
      sortBy = 'Newest First',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * pageSize;

    const activeModules = (typeof modules === 'string' ? modules.split(',') : modules)
      .map(m => m.trim())
      .filter(Boolean);

    const subQueries = [];

    // Filter values
    const lbFilter = local_body_id || localBody;
    const wardFilter = ward_id || ward;
    const activeField = (search_field || searchField || 'all').toLowerCase();
    const cleanSearch = (search || '').trim();
    const startDateVal = start_date || fromDate;
    const endDateVal = end_date || toDate;
    const activeSort = sort_by || sortBy || 'Newest First';

    // Parse array filters
    const statusArray = (Array.isArray(status) ? status : (typeof status === 'string' && status ? status.split(',') : []))
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const genderArray = (Array.isArray(gender) ? gender : (typeof gender === 'string' && gender ? gender.split(',') : []))
      .map(g => g.trim())
      .filter(Boolean);

    const ageGroupArray = (Array.isArray(age_group) ? age_group : (typeof age_group === 'string' && age_group ? age_group.split(',') : []))
      .map(a => a.trim())
      .filter(Boolean);

    // ─────────────────────────────────────────────────────────────
    // 1. Complaints (C-)
    // ─────────────────────────────────────────────────────────────
    if (activeModules.includes('C-')) {
      subQueries.push(`
        SELECT 
          c.id AS _rawId,
          COALESCE(c.reference_no, CONCAT('C-', c.id)) AS id,
          'C-' AS _module,
          'Complaint' AS _moduleName,
          c.title,
          c.complainant_name AS contactName,
          c.phone AS contactPhone,
          c.email AS contactEmail,
          COALESCE(cu.house_name, c.address_line1, '') AS houseName,
          COALESCE(c.location, c.address, '') AS locationAddress,
          c.local_body_id AS localBodyId,
          lb.name AS localBody,
          c.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          COALESCE(cu.gender, '') AS gender,
          NULL AS age,
          c.status,
          c.created_at AS _createdAt
        FROM complaints c
        LEFT JOIN local_bodies lb ON c.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON c.ward_id = lbw.id
        LEFT JOIN constituent_users cu ON c.constituent_user_id = cu.id
        WHERE c.is_deleted = 0
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Public Issues (P-)
    // ─────────────────────────────────────────────────────────────
    if (activeModules.includes('P-')) {
      subQueries.push(`
        SELECT 
          i.id AS _rawId,
          COALESCE(i.reference_no, CONCAT('P-', i.id)) AS id,
          'P-' AS _module,
          'Public Issue' AS _moduleName,
          i.title,
          i.submitter_name AS contactName,
          i.phone AS contactPhone,
          i.email AS contactEmail,
          COALESCE(cu.house_name, i.address_line1, '') AS houseName,
          COALESCE(i.location, i.address, '') AS locationAddress,
          i.local_body_id AS localBodyId,
          lb.name AS localBody,
          i.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          COALESCE(cu.gender, '') AS gender,
          NULL AS age,
          i.status,
          i.created_at AS _createdAt
        FROM issues i
        LEFT JOIN local_bodies lb ON i.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON i.ward_id = lbw.id
        LEFT JOIN constituent_users cu ON i.constituent_user_id = cu.id
        WHERE i.is_deleted = 0
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Ideas (I-)
    // ─────────────────────────────────────────────────────────────
    if (activeModules.includes('I-')) {
      subQueries.push(`
        SELECT 
          id.id AS _rawId,
          COALESCE(id.reference_no, CONCAT('I-', id.id)) AS id,
          'I-' AS _module,
          'Idea' AS _moduleName,
          id.title,
          id.complainant_name AS contactName,
          id.phone AS contactPhone,
          id.email AS contactEmail,
          COALESCE(cu.house_name, id.address_line1, '') AS houseName,
          COALESCE(id.location, id.address, '') AS locationAddress,
          id.local_body_id AS localBodyId,
          lb.name AS localBody,
          id.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          COALESCE(cu.gender, '') AS gender,
          NULL AS age,
          id.status,
          id.created_at AS _createdAt
        FROM ideas id
        LEFT JOIN local_bodies lb ON id.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON id.ward_id = lbw.id
        LEFT JOIN constituent_users cu ON id.constituent_user_id = cu.id
        WHERE id.is_deleted = 0
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Suggestions (S-)
    // ─────────────────────────────────────────────────────────────
    if (activeModules.includes('S-')) {
      subQueries.push(`
        SELECT 
          s.id AS _rawId,
          COALESCE(s.reference_no, CONCAT('S-', s.id)) AS id,
          'S-' AS _module,
          'Suggestion' AS _moduleName,
          s.title,
          s.complainant_name AS contactName,
          s.phone AS contactPhone,
          s.email AS contactEmail,
          COALESCE(cu.house_name, s.address_line1, '') AS houseName,
          COALESCE(s.location, s.address, '') AS locationAddress,
          s.local_body_id AS localBodyId,
          lb.name AS localBody,
          s.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          COALESCE(cu.gender, '') AS gender,
          NULL AS age,
          s.status,
          s.created_at AS _createdAt
        FROM suggestions s
        LEFT JOIN local_bodies lb ON s.local_body_id = lb.id
        LEFT JOIN local_body_wards lbw ON s.ward_id = lbw.id
        LEFT JOIN constituent_users cu ON s.constituent_user_id = cu.id
        WHERE s.is_deleted = 0
      `);
    }

    // ─────────────────────────────────────────────────────────────
    // 5. CM Fund Requests / Applications (F-)
    // ─────────────────────────────────────────────────────────────
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
          COALESCE(f.address_line1, '') AS houseName,
          COALESCE(f.address, f.location, '') AS locationAddress,
          f.local_body_id AS localBodyId,
          lb.name AS localBody,
          f.ward_id AS wardId,
          lbw.ward_no AS wardNum,
          lbw.place_name AS wardName,
          '' AS gender,
          NULL AS age,
          f.status,
          f.created_at AS _createdAt
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
      });
    }

    const unionSql = `(${subQueries.join(' UNION ALL ')}) AS u`;
    const whereConditions = [];
    const queryParams = [];

    // 1. Geographic Filters
    if (lbFilter) {
      whereConditions.push('u.localBodyId = ?');
      queryParams.push(lbFilter);
    }
    if (wardFilter) {
      whereConditions.push('u.wardId = ?');
      queryParams.push(wardFilter);
    }

    // 2. Date Range Filter
    if (startDateVal) {
      whereConditions.push('DATE(u._createdAt) >= ?');
      queryParams.push(startDateVal);
    }
    if (endDateVal) {
      whereConditions.push('DATE(u._createdAt) <= ?');
      queryParams.push(endDateVal);
    }

    // 3. Status Filter (Multi-select)
    if (statusArray.length > 0) {
      const statusClauses = statusArray.map(st => {
        if (st === 'pending') return "LOWER(u.status) LIKE '%pending%' OR LOWER(u.status) LIKE '%submitted%'";
        if (st === 'in_progress') return "LOWER(u.status) LIKE '%progress%' OR LOWER(u.status) LIKE '%review%' OR LOWER(u.status) LIKE '%process%'";
        if (st === 'approved') return "LOWER(u.status) LIKE '%approved%' OR LOWER(u.status) LIKE '%implemented%'";
        if (st === 'resolved') return "LOWER(u.status) LIKE '%resolved%' OR LOWER(u.status) LIKE '%closed%'";
        if (st === 'rejected') return "LOWER(u.status) LIKE '%rejected%' OR LOWER(u.status) LIKE '%cancelled%'";
        return 'LOWER(u.status) = ?';
      });
      whereConditions.push(`(${statusClauses.join(' OR ')})`);
      statusArray.forEach(st => {
        if (!['pending', 'in_progress', 'approved', 'resolved', 'rejected'].includes(st)) {
          queryParams.push(st);
        }
      });
    }

    // 4. Gender Filter
    if (genderArray.length > 0) {
      whereConditions.push(`u.gender IN (${genderArray.map(() => '?').join(',')})`);
      genderArray.forEach(g => queryParams.push(g));
    }

    // 5. Scoped Parameter Search
    if (cleanSearch) {
      const wildSearch = `%${cleanSearch}%`;

      if (activeField === 'id') {
        whereConditions.push('(u.id LIKE ? OR CAST(u._rawId AS CHAR) LIKE ?)');
        queryParams.push(wildSearch, wildSearch);
      } else if (activeField === 'name') {
        whereConditions.push('u.contactName LIKE ?');
        queryParams.push(wildSearch);
      } else if (activeField === 'phone' || activeField === 'number') {
        whereConditions.push('u.contactPhone LIKE ?');
        queryParams.push(wildSearch);
      } else if (activeField === 'email') {
        whereConditions.push('u.contactEmail LIKE ?');
        queryParams.push(wildSearch);
      } else if (activeField === 'house_name' || activeField === 'housename') {
        whereConditions.push('u.houseName LIKE ?');
        queryParams.push(wildSearch);
      } else {
        // 'all' fields search
        whereConditions.push(`(
          u.id LIKE ? OR
          u.contactName LIKE ? OR
          u.contactPhone LIKE ? OR
          u.contactEmail LIKE ? OR
          u.houseName LIKE ? OR
          u.title LIKE ? OR
          u.locationAddress LIKE ? OR
          u.localBody LIKE ?
        )`);
        queryParams.push(
          wildSearch,
          wildSearch,
          wildSearch,
          wildSearch,
          wildSearch,
          wildSearch,
          wildSearch,
          wildSearch
        );
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 6. Sorting
    let orderClause = 'ORDER BY u._createdAt DESC';
    if (activeSort === 'Oldest First') {
      orderClause = 'ORDER BY u._createdAt ASC';
    }

    // 7. Parallel Execution: Count Query + Data Query
    const countSql = `SELECT COUNT(*) AS total FROM ${unionSql} ${whereClause}`;
    const dataSql = `SELECT * FROM ${unionSql} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`;

    const [[countRows], [dataRows]] = await Promise.all([
      pool.query(countSql, queryParams),
      pool.query(dataSql, [...queryParams, pageSize, offset]),
    ]);

    const totalRecords = countRows[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / pageSize);

    return res.json({
      success: true,
      data: dataRows,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: totalRecords,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error in getTrackingRecords:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tracking records',
      error: error.message,
    });
  }
};
