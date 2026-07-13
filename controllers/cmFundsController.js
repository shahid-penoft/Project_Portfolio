import pool from '../configs/db.js';
import generateCMFundsPdf from '../utils/cmFundsPdfTemplate.js';
import { logActivity as auditLog } from './teamsLogController.js';

const generateAppId = async (connection) => {
  const year = new Date().getFullYear();
  const prefix = `CMDRF-${year}-`;
  
  const [rows] = await connection.query(
    `SELECT id FROM cm_fund_requests WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0) {
    const lastId = rows[0].id;
    const lastNumStr = lastId.replace(prefix, '');
    const lastNum = parseInt(lastNumStr, 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  const paddedNum = nextNum.toString().padStart(4, '0');
  return `${prefix}${paddedNum}`;
};

export const listRequests = async (req, res) => {
  try {
    const { status, priority, search, sort, order, page = 1, limit = 8 } = req.query;
    
    let baseQuery = `
      SELECT r.*, 
             c.name as category_name,
             u.full_name as submitted_by_name,
             o.full_name as assigned_officer_name,
             lb.name as local_body_name,
             CONCAT('Ward ', w.ward_no, ' - ', w.place_name) as ward_name
      FROM cm_fund_requests r
      LEFT JOIN cm_fund_categories c ON r.category_id = c.id
      LEFT JOIN admin_users u ON r.submitted_by_id = u.id
      LEFT JOIN admin_users o ON r.assigned_officer_id = o.id
      LEFT JOIN local_bodies lb ON r.local_body_id = lb.id
      LEFT JOIN local_body_wards w ON r.ward_id = w.id
      WHERE 1=1
    `;
    const queryParams = [];

    if (status && status !== 'All') {
      baseQuery += ` AND r.status = ?`;
      queryParams.push(status);
    }
    if (priority && priority !== 'All') {
      const priorities = priority.split(',');
      baseQuery += ` AND r.priority IN (?)`;
      queryParams.push(priorities);
    }
    if (search) {
      baseQuery += ` AND (r.applicant_name LIKE ? OR r.id LIKE ? OR c.name LIKE ? OR o.full_name LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Support both legacy aliases and new sort=<col>&order=<dir> style
    let orderClause = 'ORDER BY r.created_at DESC';
    if (sort === 'created_at' || sort === 'newest') {
      orderClause = `ORDER BY r.created_at ${order === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sort === 'oldest') {
      orderClause = 'ORDER BY r.created_at ASC';
    } else if (sort === 'amount_requested') {
      orderClause = `ORDER BY r.amount_requested ${order === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sort === 'amount_desc') {
      orderClause = 'ORDER BY r.amount_requested DESC';
    } else if (sort === 'amount_asc') {
      orderClause = 'ORDER BY r.amount_requested ASC';
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Total count query
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as t`;
    const [countRows] = await pool.query(countQuery, queryParams);
    const total = countRows[0].total;

    // Data query
    const dataQuery = `${baseQuery} ${orderClause} LIMIT ? OFFSET ?`;
    const [data] = await pool.query(dataQuery, [...queryParams, parseInt(limit), offset]);

    // Status counts — keys match frontend Tabs display values
    const [statusRows] = await pool.query(`
      SELECT status, COUNT(*) as count FROM cm_fund_requests GROUP BY status
    `);
    
    const counts = { all: 0 };
    let totalCount = 0;
    statusRows.forEach(row => {
      totalCount += parseInt(row.count, 10);
      counts[row.status] = parseInt(row.count, 10); // e.g. counts['Under Review'] = 3
    });
    counts.all = totalCount;

    res.json({
      data,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      counts
    });
  } catch (err) {
    console.error('Error in listRequests:', err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

export const createRequest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Accept both snake_case (FormData from frontend) and camelCase
    const b = req.body;
    const applicantName       = b.applicant_name      || b.applicantName;
    const applicationType     = b.application_type    || b.applicationType || 'CMDRF';
    const applicantPhone      = b.applicant_phone     || b.applicantPhone;
    const alternatePhone      = b.alternate_phone     || b.alternatePhone     || null;
    const aadhaarNumber       = b.aadhaar_number      || b.aadhaarNumber      || null;
    const rationCardNumber    = b.ration_card_number  || b.rationCardNumber   || null;
    const localBody           = b.local_body          || b.localBody          || null;
    const ward                = b.ward                                         || null;
    const addressLine1        = b.address_line1       || b.addressLine1;
    const addressLine2        = b.address_line2       || b.addressLine2       || null;
    const city                = b.city;
    const district            = b.district;
    const state               = b.state               || 'Kerala';
    const pincode             = b.pincode;
    const categoryId          = b.category_id         || b.category;
    const subCategory         = b.sub_category        || b.subCategory        || null;
    const priority            = b.priority            || 'Normal';
    const amountRequested     = b.amount_requested    || b.amountRequested;
    const description         = b.description;
    const bankName            = b.bank_name           || b.bankName;
    const accountNumber       = b.account_number      || b.accountNumber;
    const ifscCode            = b.ifsc_code           || b.ifscCode;
    const branch              = b.branch;
    const accountHolderName   = b.account_holder_name || b.accountHolderName;
    const recommendedBy       = b.recommended_by      || b.recommendedBy;
    const recommenderName     = b.recommender_name    || b.recommenderName    || null;
    const recommenderContact  = b.recommender_contact || b.recommenderContact || null;
    const remarks             = b.remarks             || null;

    if (!applicantName || !applicantPhone || !addressLine1 || !city || !district || !pincode || 
        !categoryId || !amountRequested || !description || !bankName || !accountNumber || !ifscCode || 
        !branch || !accountHolderName || !recommendedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await connection.beginTransaction();

    const appId = await generateAppId(connection);
    const userId = req.admin ? req.admin.id : null;

    let assignedOfficerId = b.assigned_officer_id || b.officer || null;
    if (assignedOfficerId === "Unassigned") assignedOfficerId = null;
    let initialStatus = b.status || 'Submitted';

    await connection.query(`
      INSERT INTO cm_fund_requests (
        id, applicant_name, applicant_phone, alternate_phone, aadhaar_number, ration_card_number,
        local_body_id, ward_id, address_line1, address_line2, city, district, state, pincode, application_type,
        category_id, sub_category, priority, amount_requested, description,
        bank_name, account_number, ifsc_code, branch, account_holder_name,
        recommended_by, recommender_name, recommender_contact, remarks,
        status, assigned_officer_id, submitted_by_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      appId, applicantName, applicantPhone, alternatePhone, aadhaarNumber, rationCardNumber,
      localBody, ward, addressLine1, addressLine2, city, district, state, pincode, applicationType,
      categoryId, subCategory, priority, amountRequested, description,
      bankName, accountNumber, ifscCode, branch, accountHolderName,
      recommendedBy, recommenderName, recommenderContact, remarks,
      initialStatus, assignedOfficerId, userId
    ]);

    // Handle uploaded documents
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let docId = file.fieldname;
        const match = docId.match(/documents\[(.*?)\]/);
        if (match) docId = match[1];

        const fileUrl = file.location || `/uploads/cm_fund_documents/${file.filename}`;
        
        await connection.query(`
          INSERT INTO cm_fund_request_documents (request_id, doc_type_id, file_url, original_filename)
          VALUES (?, ?, ?, ?)
        `, [appId, docId, fileUrl, file.originalname]);
      }
    }

    // Add timeline event
    await connection.query(`
      INSERT INTO cm_fund_timeline_events (request_id, event_type, to_status, actor_id, note)
      VALUES (?, 'Application Received', 'Submitted', ?, 'Application submitted successfully')
    `, [appId, userId]);

    await connection.commit();
    auditLog(req, { action: 'Created', module: 'CM Funds', details: `CM Funds application submitted — ${applicantName} (${appId})`, resource: `cm-funds/${appId}`, severity: 'info' });
    res.status(201).json({ message: 'Application submitted successfully', id: appId });
  } catch (err) {
    await connection.rollback();
    console.error('Error in createRequest:', err);
    res.status(500).json({ error: 'Failed to create request' });
  } finally {
    connection.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/cm-funds/draft
// Lightweight quick-add — only 5 fields required; status forced to 'Draft'.
// Does NOT affect the main createRequest validation.
// ─────────────────────────────────────────────────────────────────────────────
export const createDraftRequest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const b = req.body;
    const applicantName    = b.applicant_name   || b.applicantName;
    const applicationType  = b.application_type || b.applicationType || 'CMDRF';
    const applicantPhone   = b.applicant_phone  || b.applicantPhone || b.phone;
    const categoryId       = b.category_id      || b.category;
    const amountRequested  = b.amount_requested || b.amountRequested;
    const description      = b.description      || null;
    const priority         = b.priority         || 'Normal';
    const remarks          = b.remarks          || null;

    if (!applicantName || !applicantPhone || !categoryId || !amountRequested) {
      return res.status(400).json({
        error: 'Missing required fields: applicant_name, phone, category_id, amount_requested',
      });
    }

    await connection.beginTransaction();

    const appId  = await generateAppId(connection);
    const userId = req.admin ? req.admin.id : null;

    await connection.query(`
      INSERT INTO cm_fund_requests (
        id, applicant_name, applicant_phone, category_id, priority,
        amount_requested, description, remarks,
        status, submitted_by_id,
        address_line1, city, district, state, pincode, application_type,
        bank_name, account_number, ifsc_code, branch, account_holder_name, recommended_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?,
                '', '', '', 'Kerala', '', ?,
                '', '', '', '', '', '')
    `, [
      appId, applicantName, applicantPhone, categoryId, priority,
      amountRequested, description, remarks,
      userId, applicationType,
    ]);

    await connection.query(`
      INSERT INTO cm_fund_timeline_events (request_id, event_type, to_status, actor_id, note)
      VALUES (?, 'Draft Created', 'Draft', ?, 'Quick draft saved via sidebar')
    `, [appId, userId]);

    await connection.commit();
    auditLog(req, { action: 'Created', module: 'CM Funds', details: `CM Funds draft saved — ${applicantName} (${appId})`, resource: `cm-funds/${appId}`, severity: 'info' });
    res.status(201).json({ message: 'Draft saved successfully', id: appId });
  } catch (err) {
    await connection.rollback();
    console.error('[createDraftRequest]', err);
    res.status(500).json({ error: 'Failed to save draft' });
  } finally {
    connection.release();
  }
};

export const getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT r.*, 
             c.name as category_name,
             u.full_name as submitted_by_name,
             o.full_name as assigned_officer_name,
             lb.name as local_body_name,
             w.name as ward_name
      FROM cm_fund_requests r
      LEFT JOIN cm_fund_categories c ON r.category_id = c.id
      LEFT JOIN admin_users u ON r.submitted_by_id = u.id
      LEFT JOIN admin_users o ON r.assigned_officer_id = o.id
      LEFT JOIN local_bodies lb ON r.local_body_id = lb.id
      LEFT JOIN local_body_wards w ON r.ward_id = w.id
      WHERE r.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = rows[0];

    const [docs] = await pool.query(`
      SELECT d.*, t.name as doc_name, t.description as doc_description
      FROM cm_fund_request_documents d
      JOIN cm_fund_document_types t ON d.doc_type_id = t.id
      WHERE d.request_id = ?
    `, [id]);

    const [timeline] = await pool.query(`
      SELECT t.*, u.full_name as actor_name
      FROM cm_fund_timeline_events t
      LEFT JOIN admin_users u ON t.actor_id = u.id
      WHERE t.request_id = ?
      ORDER BY t.created_at DESC
    `, [id]);

    res.json({ data: { ...request, documents: docs, timeline } });
  } catch (err) {
    console.error('Error in getRequest:', err);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
};

export const updateRequest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    
    // Partial update allowed
    const updatableFields = [
      'applicant_name', 'applicant_phone', 'alternate_phone', 'aadhaar_number', 'ration_card_number',
      'local_body_id', 'ward_id', 'address_line1', 'address_line2', 'city', 'district', 'state', 'pincode', 'application_type',
      'category_id', 'sub_category', 'priority', 'amount_requested', 'description',
      'bank_name', 'account_number', 'ifsc_code', 'branch', 'account_holder_name',
      'recommended_by', 'recommender_name', 'recommender_contact', 'remarks'
    ];

    const setParts = [];
    const values = [];

    // Map body keys to DB columns
    const bodyToDb = {
      applicantName: 'applicant_name', applicantPhone: 'applicant_phone', alternatePhone: 'alternate_phone', 
      aadhaarNumber: 'aadhaar_number', rationCardNumber: 'ration_card_number',
      localBody: 'local_body_id', ward: 'ward_id', addressLine1: 'address_line1', addressLine2: 'address_line2', 
      city: 'city', district: 'district', state: 'state', pincode: 'pincode', applicationType: 'application_type',
      category: 'category_id', subCategory: 'sub_category', priority: 'priority', 
      amountRequested: 'amount_requested', description: 'description',
      bankName: 'bank_name', accountNumber: 'account_number', ifscCode: 'ifsc_code', 
      branch: 'branch', accountHolderName: 'account_holder_name',
      recommendedBy: 'recommended_by', recommenderName: 'recommender_name', 
      recommenderContact: 'recommender_contact', remarks: 'remarks',
      status: 'status', officer: 'assigned_officer_id', assignedOfficerId: 'assigned_officer_id'
    };

    for (const [camelKey, dbKey] of Object.entries(bodyToDb)) {
      // Check for either the snake_case key (from FormData) or the camelCase key
      let value = req.body[dbKey] !== undefined ? req.body[dbKey] : req.body[camelKey];
      if (dbKey === 'assigned_officer_id' && value === 'Unassigned') {
        value = null;
      }
      if (value !== undefined) {
        setParts.push(`${dbKey} = ?`);
        values.push(value || null); // Convert empty strings to null for optional fields
      }
    }

    if (setParts.length === 0 && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'No data provided to update' });
    }

    await connection.beginTransaction();

    if (setParts.length > 0) {
      values.push(id);
      await connection.query(`UPDATE cm_fund_requests SET ${setParts.join(', ')} WHERE id = ?`, values);
    }

    // Handle uploaded documents
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let docId = file.fieldname;
        const match = docId.match(/documents\[(.*?)\]/);
        if (match) docId = match[1];

        const fileUrl = file.location || `/uploads/cm_fund_documents/${file.filename}`;
        
        // Upsert strategy for documents (remove old one first if exists)
        await connection.query(`DELETE FROM cm_fund_request_documents WHERE request_id = ? AND doc_type_id = ?`, [id, docId]);
        
        await connection.query(`
          INSERT INTO cm_fund_request_documents (request_id, doc_type_id, file_url, original_filename)
          VALUES (?, ?, ?, ?)
        `, [id, docId, fileUrl, file.originalname]);
      }
    }
    
    // Add timeline event
    const userId = req.admin ? req.admin.id : null;
    await connection.query(`
      INSERT INTO cm_fund_timeline_events (request_id, event_type, actor_id, note)
      VALUES (?, 'Application Updated', ?, 'Application details/documents were modified')
    `, [id, userId]);

    await connection.commit();
    auditLog(req, { action: 'Updated', module: 'CM Funds', details: `CM Funds application updated — ID ${id}`, resource: `cm-funds/${id}`, severity: 'success' });
    res.json({ message: 'Application updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error in updateRequest:', err);
    res.status(500).json({ error: 'Failed to update request' });
  } finally {
    connection.release();
  }
};

export const updateStatus = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status, approvedAmount } = req.body;
    
    if (!status) return res.status(400).json({ error: 'Status is required' });

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT status FROM cm_fund_requests WHERE id = ?', [id]);
    if (rows.length === 0) {
       await connection.rollback();
       return res.status(404).json({ error: 'Request not found' });
    }
    const oldStatus = rows[0].status;

    if (oldStatus === status) {
       await connection.rollback();
       return res.json({ message: 'Status is already ' + status });
    }

    const updateQuery = `UPDATE cm_fund_requests SET status = ? ${approvedAmount !== undefined ? ', approved_amount = ?' : ''} WHERE id = ?`;
    const updateParams = approvedAmount !== undefined ? [status, approvedAmount, id] : [status, id];
    
    await connection.query(updateQuery, updateParams);

    // Event type logic
    let eventType = 'Status Changed';
    if (status === 'Under Review') eventType = 'Review Started';
    else if (status === 'Approved') eventType = 'Approved for CM Fund';
    else if (status === 'Disbursed') eventType = 'Funds Disbursed';
    else if (status === 'Rejected') eventType = 'Application Rejected';

    const userId = req.admin ? req.admin.id : null;
    await connection.query(`
      INSERT INTO cm_fund_timeline_events (request_id, event_type, from_status, to_status, actor_id, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, eventType, oldStatus, status, userId, `Status updated to ${status}`]);

    await connection.commit();
    const auditSeverity = status === 'Disbursed' ? 'success' : (status === 'Rejected' ? 'error' : 'info');
    auditLog(req, { action: 'Updated', module: 'CM Funds', details: `CM Funds application ${id} status changed: ${oldStatus} → ${status}`, resource: `cm-funds/${id}`, severity: auditSeverity });
    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error in updateStatus:', err);
    res.status(500).json({ error: 'Failed to update status' });
  } finally {
    connection.release();
  }
};

export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Configs are cascade deleted by FK constraint.
    await pool.query(`DELETE FROM cm_fund_requests WHERE id = ?`, [id]);

    auditLog(req, { action: 'Deleted', module: 'CM Funds', details: `CM Funds application ${id} permanently deleted`, resource: `cm-funds/${id}`, severity: 'error' });
    res.json({ message: 'Application deleted successfully' });
  } catch (err) {
    console.error('Error in deleteRequest:', err);
    res.status(500).json({ error: 'Failed to delete application' });
  }
};

export const downloadPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT r.*, 
             c.name as category_name
      FROM cm_fund_requests r
      LEFT JOIN cm_fund_categories c ON r.category_id = c.id
      WHERE r.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    
    const [settings] = await pool.query(`
      SELECT value FROM site_settings WHERE setting_key = 'mla_letter_template' LIMIT 1
    `);
    const templateConfig = settings.length > 0 && settings[0].value ? JSON.parse(settings[0].value) : null;

    const pdfBuffer = await generateCMFundsPdf(rows[0], templateConfig);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error in downloadPdf:', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};
