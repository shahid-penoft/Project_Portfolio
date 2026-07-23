import pool from '../configs/db.js';
import generateCMFundsPdf from '../utils/cmFundsPdfTemplate.js';
import { logActivity as auditLog } from './teamsLogController.js';
import { broadcastNotification, createNotification } from '../utils/notificationHelper.js';
import { sendSMSSafe } from '../services/smsService.js';
import { followUpUpdateSMS, submissionConfirmationSMS } from '../services/smsTemplates.js';
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

/**
 * Helper to resolve raw category input (which could be an ID in cm_fund_categories,
 * an ID in mla_dropdown_lists, or a category name string) to a valid cm_fund_categories(id)
 * or NULL if invalid.
 */
async function resolveCategoryId(connection, rawCategoryId) {
    if (!rawCategoryId || rawCategoryId === 'undefined' || rawCategoryId === 'null') return null;

    // 1. Check if rawCategoryId exists directly in cm_fund_categories
    const [existing] = await connection.query('SELECT id FROM cm_fund_categories WHERE id = ?', [rawCategoryId]);
    if (existing.length > 0) return existing[0].id;

    // 2. If rawCategoryId is numeric, check if it matches an option in mla_dropdown_lists
    let categoryName = String(rawCategoryId).trim();
    if (!isNaN(rawCategoryId)) {
        const [dropOpt] = await connection.query('SELECT value FROM mla_dropdown_lists WHERE id = ?', [rawCategoryId]);
        if (dropOpt.length > 0) {
            categoryName = dropOpt[0].value;
        }
    }

    // 3. Search cm_fund_categories by name
    const [byName] = await connection.query('SELECT id FROM cm_fund_categories WHERE name = ? LIMIT 1', [categoryName]);
    if (byName.length > 0) return byName[0].id;

    // 4. If not found, attempt to insert into cm_fund_categories so foreign key constraint succeeds
    try {
        const [ins] = await connection.query('INSERT INTO cm_fund_categories (name, application_type) VALUES (?, ?)', [categoryName, 'General']);
        return ins.insertId;
    } catch (e) {
        console.warn('[resolveCategoryId] Fallback lookup failed:', e.message);
        return null;
    }
}

const generateAppId = async (connection, applicationType) => {
  const isCmdrf = applicationType && applicationType.toUpperCase() === 'CMDRF';
  const prefix = isCmdrf ? 'CM-' : 'A-';
  
  const [rows] = await connection.query(
    `SELECT id FROM cm_fund_requests WHERE id LIKE ? ORDER BY CAST(SUBSTR(id, ?) AS UNSIGNED) DESC LIMIT 1`,
    [`${prefix}%`, prefix.length + 1]
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

  const paddedNum = nextNum.toString().padStart(3, '0');
  return `${prefix}${paddedNum}`;
};

export const getNextAppId = async (req, res) => {
  try {
    const { application_type } = req.query;
    const nextId = await generateAppId(pool, application_type || 'CMDRF');
    res.json({ nextId });
  } catch (err) {
    console.error('Error getting next application ID:', err);
    res.status(500).json({ error: 'Failed to generate application ID' });
  }
};

export const listRequests = async (req, res) => {
  try {
    const { status, priority, search, sort, order, page = 1, limit = 8 } = req.query;
    
    const isTrash = req.query.is_deleted === '1' || req.query.trash === 'true';

    let baseQuery = `
      SELECT r.*,
             c.name as category_name,
             u.full_name as submitted_by_name,
             o.full_name as assigned_officer_name,
             d.full_name as deleted_by_name,
             lb.name as local_body_name,
             CONCAT('Ward ', w.ward_no, ' - ', w.place_name) as ward_name
      FROM cm_fund_requests r
      LEFT JOIN cm_fund_categories c ON r.category_id = c.id
      LEFT JOIN admin_users u ON r.submitted_by_id = u.id
      LEFT JOIN admin_users o ON r.assigned_officer_id = o.id
      LEFT JOIN admin_users d ON r.deleted_by_id = d.id
      LEFT JOIN local_bodies lb ON r.local_body_id = lb.id
      LEFT JOIN local_body_wards w ON r.ward_id = w.id
      WHERE r.is_deleted = ?
    `;
    const queryParams = [isTrash ? 1 : 0];

    if (!isTrash && status && status !== 'All') {
      baseQuery += ` AND r.status = ?`;
      queryParams.push(status);
    }
    if (priority && priority !== 'All') {
      const priorities = priority.split(',');
      baseQuery += ` AND r.priority IN (?)`;
      queryParams.push(priorities);
    }
    if (search) {
      baseQuery += ` AND (
        r.applicant_name LIKE ? OR 
        r.id LIKE ? OR 
        r.applicant_phone LIKE ? OR 
        r.application_title LIKE ? OR 
        r.application_type LIKE ? OR 
        c.name LIKE ? OR 
        r.sub_category LIKE ? OR 
        lb.name LIKE ? OR 
        w.place_name LIKE ? OR 
        o.full_name LIKE ?
      )`;
      const s = `%${search}%`;
      queryParams.push(s, s, s, s, s, s, s, s, s, s);
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
    const applicationTitle    = b.application_title   || b.applicationTitle   || null;
    const applicantName       = b.applicant_name      || b.applicantName;
    const applicationType     = b.application_type    || b.applicationType || 'CMDRF';
    const applicantPhone      = b.applicant_phone     || b.applicantPhone     || '';
    const alternatePhone      = b.alternate_phone     || b.alternatePhone     || null;
    const aadhaarNumber       = b.aadhaar_number      || b.aadhaarNumber      || null;
    const rationCardNumber    = b.ration_card_number  || b.rationCardNumber   || null;
    const panCardNumber       = b.pan_card_number     || b.panCardNumber      || null;
    const localBody           = b.local_body          || b.localBody          || null;
    const ward                = b.ward                                         || null;
    const addressLine1        = b.address_line1       || b.addressLine1       || '';
    const addressLine2        = b.address_line2       || b.addressLine2       || null;
    const address             = b.address             || null;
    const location            = b.location            || null;
    const latitude            = b.latitude            || null;
    const longitude           = b.longitude           || null;
    const city                = b.city                || '';
    const district            = b.district            || '';
    const state               = b.state               || 'Kerala';
    const pincode             = b.pincode             || '';
    const rawCategoryId       = b.category_id         || b.category;
    const categoryId          = await resolveCategoryId(pool, rawCategoryId);
    const subCategory         = b.sub_category        || b.subCategory        || null;
    const priority            = b.priority            || 'Normal';
    const amountRequested     = b.amount_requested    || b.amountRequested    || null;
    const description         = b.description         || '';
    const bankName            = b.bank_name           || b.bankName           || '';
    const accountNumber       = b.account_number      || b.accountNumber      || '';
    const ifscCode            = b.ifsc_code           || b.ifscCode           || '';
    const branch              = b.branch              || '';
    const accountHolderName   = b.account_holder_name || b.accountHolderName  || '';
    const recommendedBy       = b.recommended_by      || b.recommendedBy      || '';
    const recommenderName     = b.recommender_name    || b.recommenderName    || null;
    const recommenderContact  = b.recommender_contact || b.recommenderContact || null;
    const remarks             = b.remarks             || null;
    const dateFiled           = b.date_filed          || null;

    if (!applicationType || !applicantName) {
      return res.status(400).json({ error: 'Missing required fields: Application Type or Applicant Name' });
    }

    await connection.beginTransaction();

    const appId = await generateAppId(connection, applicationType);
    const userId = req.admin ? req.admin.id : null;

    let assignedOfficerId = b.assigned_officer_id || b.officer || null;
    if (assignedOfficerId === "Unassigned") assignedOfficerId = null;
    let initialStatus = b.status || 'Submitted';

    await connection.query(`
      INSERT INTO cm_fund_requests (
        id, application_title, applicant_name, applicant_phone, alternate_phone, aadhaar_number, ration_card_number, pan_card_number,
        local_body_id, ward_id, address_line1, address_line2, address, location, latitude, longitude, city, district, state, pincode, application_type,
        category_id, sub_category, priority, amount_requested, description,
        bank_name, account_number, ifsc_code, branch, account_holder_name,
        recommended_by, recommender_name, recommender_contact, remarks,
        status, assigned_officer_id, submitted_by_id, date_filed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      appId, applicationTitle, applicantName, applicantPhone, alternatePhone, aadhaarNumber, rationCardNumber, panCardNumber,
      localBody, ward, addressLine1, addressLine2, address, location, latitude, longitude, city, district, state, pincode, applicationType,
      categoryId, subCategory, priority, amountRequested, description,
      bankName, accountNumber, ifscCode, branch, accountHolderName,
      recommendedBy, recommenderName, recommenderContact, remarks,
      initialStatus, assignedOfficerId, userId, dateFiled
    ]);

    // Handle uploaded documents
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let docId = file.fieldname;
        if (docId.startsWith('audioNotes')) {
          docId = 'doc_audio_note';
        } else {
          const match = docId.match(/documents\[(.*?)\]/);
          if (match) docId = match[1];
        }

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
    
    // Notify all admins
    broadcastNotification({
      title: `New CM Fund Request ${appId}`,
      message: `${applicantName} has submitted a new CM Fund application.`,
      type: 'cmfund', module: 'CM Funds',
      record_id: null, record_ref: appId,
      link_path: `/mlaconnect/cm-funds/${appId}`,
    });

    // Notify Applicant
    if (b.notify_applicant === 'true' && applicantPhone) {
      const message = b.custom_message || submissionConfirmationSMS({
        name: applicantName,
        dateFiled: dateFiled || new Date().toISOString().split('T')[0],
        referenceNo: appId,
      });
      await sendSMSSafe(applicantPhone, message, {
        referenceNo: appId,
        module: 'cm-funds',
        recipientName: applicantName
      });
    }

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
    const applicationTitle = b.application_title || b.applicationTitle || null;
    const rawCategoryId    = b.category_id      || b.category;
    const categoryId       = await resolveCategoryId(pool, rawCategoryId);
    const subCategory      = b.sub_category     || b.subCategory || null;
    const addressLine1     = b.address_line1    || b.addressLine1 || b.house_name || '';
    const localBody        = b.local_body       || b.localBody || null;
    const ward             = b.ward             || null;
    const recommendedBy    = b.recommended_by   || b.recommendedBy || '';
    const amountRequested  = b.amount_requested || b.amountRequested || null;
    const description      = b.description      || '';
    const priority         = b.priority         || 'Normal';
    const remarks          = b.remarks          || null;

    if (!applicantName || !applicantPhone) {
      return res.status(400).json({
        error: 'Missing required fields: applicant_name, phone',
      });
    }

    await connection.beginTransaction();

    const appId  = await generateAppId(connection, applicationType);
    const userId = req.admin ? req.admin.id : null;

    await connection.query(`
      INSERT INTO cm_fund_requests (
        id, application_title, applicant_name, applicant_phone, category_id, sub_category, priority,
        amount_requested, description, remarks,
        status, submitted_by_id,
        address_line1, local_body_id, ward_id, city, district, state, pincode, application_type,
        bank_name, account_number, ifsc_code, branch, account_holder_name, recommended_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?,
                ?, ?, ?, '', '', 'Kerala', '', ?,
                '', '', '', '', '', ?)
    `, [
      appId, applicationTitle, applicantName, applicantPhone, categoryId, subCategory, priority,
      amountRequested, description, remarks,
      userId,
      addressLine1, localBody, ward, applicationType,
      recommendedBy
    ]);

    await connection.query(`
      INSERT INTO cm_fund_timeline_events (request_id, event_type, to_status, actor_id, note)
      VALUES (?, 'Draft Created', 'Draft', ?, 'Quick draft saved via sidebar')
    `, [appId, userId]);

    // Handle uploaded documents (including audioNotes which we will map to doc_audio_note)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let docId = file.fieldname;
        // Check if it's audioNotes
        if (docId.startsWith('audioNotes')) {
          docId = 'doc_audio_note';
        } else {
          // Standard document array e.g. documents[doc_med_cert]
          const match = docId.match(/documents\[(.*?)\]/);
          if (match) docId = match[1];
        }

        const fileUrl = file.location || `/uploads/cm_fund_documents/${file.filename}`;
        
        await connection.query(`
          INSERT INTO cm_fund_request_documents (request_id, doc_type_id, file_url, original_filename)
          VALUES (?, ?, ?, ?)
        `, [appId, docId, fileUrl, file.originalname]);
      }
    }

    // Notify Applicant
    if (b.notify_applicant === 'true' && applicantPhone) {
      const message = b.custom_message || submissionConfirmationSMS({
        name: applicantName,
        dateFiled: new Date().toISOString().split('T')[0],
        referenceNo: appId,
      });
      await sendSMSSafe(applicantPhone, message, {
        referenceNo: appId,
        module: 'cm-funds',
        recipientName: applicantName
      });
    }

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
             d.full_name as deleted_by_name,
             lb.name as local_body_name,
             up.full_name as updated_by_admin_name,
             CONCAT('Ward ', w.ward_no, ' - ', w.place_name) as ward_name
      FROM cm_fund_requests r
      LEFT JOIN cm_fund_categories c ON r.category_id = c.id
      LEFT JOIN admin_users u ON r.submitted_by_id = u.id
      LEFT JOIN admin_users o ON r.assigned_officer_id = o.id
      LEFT JOIN admin_users d ON r.deleted_by_id = d.id
      LEFT JOIN admin_users up ON r.updated_by_admin_id = up.id
      LEFT JOIN local_bodies lb ON r.local_body_id = lb.id
      LEFT JOIN local_body_wards w ON r.ward_id = w.id
      WHERE r.id = ? AND r.is_deleted = 0
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const request = rows[0];

    const [docs] = await pool.query(`
      SELECT d.*, t.name as doc_name, t.description as doc_description
      FROM cm_fund_request_documents d
      LEFT JOIN cm_fund_document_types t ON d.doc_type_id = t.id
      WHERE d.request_id = ?
    `, [id]);

    const [timeline] = await pool.query(`
      SELECT t.*, u.full_name as actor_name
      FROM cm_fund_timeline_events t
      LEFT JOIN admin_users u ON t.actor_id = u.id
      WHERE t.request_id = ?
      ORDER BY t.created_at DESC
    `, [id]);

    const [updates] = await pool.query(`
      SELECT u.*, m.media_type, m.file_url, m.file_name
      FROM cm_fund_updates u
      LEFT JOIN cm_fund_update_media m ON u.id = m.update_id
      WHERE u.request_id = ?
      ORDER BY u.created_at DESC
    `, [id]);

    const formattedUpdatesMap = {};
    updates.forEach(row => {
      if (!formattedUpdatesMap[row.id]) {
        formattedUpdatesMap[row.id] = {
          id: row.id,
          request_id: row.request_id,
          type: row.type,
          title: row.title,
          note: row.note,
          created_at: row.created_at,
          notify_complainant: row.notify_complainant,
          gallery: [],
          attachments: []
        };
      }
      if (row.file_url) {
        if (row.media_type === 'document') {
          formattedUpdatesMap[row.id].attachments.push({
            id: row.file_url,
            name: row.file_name || 'Document',
            file_url: row.file_url
          });
        } else {
          formattedUpdatesMap[row.id].gallery.push({
            id: row.file_url,
            type: row.media_type,
            previewUrl: row.file_url
          });
        }
      }
    });
    
    // Convert map to array and sort DESC
    const updatesArray = Object.values(formattedUpdatesMap).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ data: { ...request, documents: docs, timeline, updates: updatesArray } });
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
      'application_title', 'applicant_name', 'applicant_phone', 'alternate_phone', 'aadhaar_number', 'ration_card_number', 'pan_card_number',
      'local_body_id', 'ward_id', 'address_line1', 'address_line2', 'address', 'location', 'latitude', 'longitude', 'city', 'district', 'state', 'pincode', 'application_type',
      'category_id', 'sub_category', 'priority', 'amount_requested', 'description',
      'bank_name', 'account_number', 'ifsc_code', 'branch', 'account_holder_name',
      'recommended_by', 'recommender_name', 'recommender_contact', 'remarks', 'date_filed'
    ];

    const setParts = [];
    const values = [];

    // Map body keys to DB columns
    const bodyToDb = {
      applicationTitle: 'application_title', panCardNumber: 'pan_card_number', address: 'address', location: 'location', latitude: 'latitude', longitude: 'longitude',
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
      status: 'status', officer: 'assigned_officer_id', assignedOfficerId: 'assigned_officer_id',
      dateFiled: 'date_filed', date_filed: 'date_filed'
    };

    const sanitize = (val) => (val === 'undefined' || val === 'null') ? '' : val;
    
    // Fields that are NOT NULL in the database schema
    const notNullFields = new Set([
      'applicant_name', 'applicant_phone', 'address_line1', 'city', 'district', 'pincode',
      'description', 'bank_name', 'account_number', 'ifsc_code', 'branch', 'account_holder_name', 'recommended_by'
    ]);

    for (const [camelKey, dbKey] of Object.entries(bodyToDb)) {
      // Check for either the snake_case key (from FormData) or the camelCase key
      let value = req.body[dbKey] !== undefined ? req.body[dbKey] : req.body[camelKey];
      
      if (typeof value === 'string') {
        value = sanitize(value);
      }
      
      if (dbKey === 'assigned_officer_id' && value === 'Unassigned') {
        value = null;
      }
      if (dbKey === 'category_id' && value) {
        value = await resolveCategoryId(pool, value);
      }
      if (value !== undefined) {
        setParts.push(`${dbKey} = ?`);
        if (value === '') {
          values.push(notNullFields.has(dbKey) ? '' : null);
        } else {
          values.push(value);
        }
      }
    }

    if (setParts.length === 0 && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'No data provided to update' });
    }

    // Ensure required fields are not being nullified or are provided if updating
    const getVal = (snake, camel) => req.body[snake] !== undefined ? req.body[snake] : req.body[camel];
    
    const checkAppType = sanitize(getVal('application_type', 'applicationType'));
    const checkAppName = sanitize(getVal('applicant_name', 'applicantName'));
    const checkCategory = sanitize(getVal('category_id', 'category'));
    const checkDesc = sanitize(getVal('description', 'description'));

    if (
      (checkAppType !== undefined && !checkAppType) ||
      (checkAppName !== undefined && !checkAppName) ||
      (checkCategory !== undefined && !checkCategory) ||
      (checkDesc !== undefined && !checkDesc)
    ) {
      return res.status(400).json({ error: 'Missing required fields: Application Type, Applicant Name, Category, or Description cannot be empty' });
    }

    await connection.beginTransaction();

    if (setParts.length > 0) {
      setParts.push('updated_by_admin_id = ?');
      values.push(req.admin?.id || null);
      if (req.admin?.id) {
        setParts.push('submitted_by_id = COALESCE(submitted_by_id, ?)');
        values.push(req.admin.id);
      }
      values.push(id);
      await connection.query(`UPDATE cm_fund_requests SET ${setParts.join(', ')} WHERE id = ?`, values);
    }

    // Handle uploaded documents
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        let docId = file.fieldname;
        if (docId.startsWith('audioNotes')) {
          docId = 'doc_audio_note';
        } else {
          const match = docId.match(/documents\[(.*?)\]/);
          if (match) docId = match[1];
        }

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

    const updateQuery = `UPDATE cm_fund_requests SET status = ?, updated_by_admin_id = ? ${approvedAmount !== undefined ? ', approved_amount = ?' : ''} WHERE id = ?`;
    const updateParams = approvedAmount !== undefined ? [status, req.admin?.id || null, approvedAmount, id] : [status, req.admin?.id || null, id];
    
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
    // Notify assigned officer if present
    const [[cmReq]] = await pool.query('SELECT assigned_officer_id FROM cm_fund_requests WHERE id = ?', [id]);
    if (cmReq?.assigned_officer_id) {
      createNotification(cmReq.assigned_officer_id, {
        title: `CM Fund ${id} status updated to ${status}`,
        message: `Status changed from "${oldStatus}" to "${status}".`,
        type: 'cmfund', module: 'CM Funds',
        record_ref: id, link_path: `/mlaconnect/cm-funds/${id}`,
      });
    }
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
    const userId = req.admin ? req.admin.id : null;

    // Soft-delete: mark as deleted, set timestamp and actor
    await pool.query(
      `UPDATE cm_fund_requests SET is_deleted = 1, deleted_at = NOW(), deleted_by_id = ? WHERE id = ?`,
      [userId, id]
    );

    auditLog(req, { action: 'Deleted', module: 'CM Funds', details: `CM Funds application ${id} moved to trash`, resource: `cm-funds/${id}`, severity: 'warning' });
    res.json({ message: 'Application moved to trash' });
  } catch (err) {
    console.error('Error in deleteRequest:', err);
    res.status(500).json({ error: 'Failed to delete application' });
  }
};

export const restoreRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT id FROM cm_fund_requests WHERE id = ? AND is_deleted = 1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Trashed application not found' });

    await pool.query(
      `UPDATE cm_fund_requests SET is_deleted = 0, deleted_at = NULL, deleted_by_id = NULL WHERE id = ?`,
      [id]
    );

    auditLog(req, { action: 'Restored', module: 'CM Funds', details: `CM Funds application ${id} restored from trash`, resource: `cm-funds/${id}`, severity: 'info' });
    res.json({ message: 'Application restored successfully' });
  } catch (err) {
    console.error('Error in restoreRequest:', err);
    res.status(500).json({ error: 'Failed to restore application' });
  }
};

export const permanentDeleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    // Hard-delete from DB (no is_deleted guard — permanent regardless of state)
    const [result] = await pool.query(`DELETE FROM cm_fund_requests WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    auditLog(req, { action: 'Deleted', module: 'CM Funds', details: `CM Funds application ${id} permanently deleted`, resource: `cm-funds/${id}`, severity: 'error' });
    res.json({ message: 'Application permanently deleted' });
  } catch (err) {
    console.error('Error in permanentDeleteRequest:', err);
    res.status(500).json({ error: 'Failed to permanently delete application' });
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

export const addUpdate = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { type, title, note, notify_complainant, custom_sms_message } = req.body;
    const isNotify = notify_complainant === 'true' || notify_complainant === true;

    if (!title || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await connection.beginTransaction();

    const [requestRows] = await connection.query(`SELECT applicant_name, applicant_phone, status FROM cm_fund_requests WHERE id = ?`, [id]);
    if (requestRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Application not found' });
    }
    const application = requestRows[0];

    // Insert the update
    const [result] = await connection.query(`
      INSERT INTO cm_fund_updates (request_id, type, title, note, notify_complainant)
      VALUES (?, ?, ?, ?, ?)
    `, [id, type, title, note || null, isNotify ? 1 : 0]);
    
    const updateId = result.insertId;

    // Insert Media
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = file.location || `/uploads/cm_fund_documents/${file.filename}`;
        const isVideo = file.mimetype.startsWith('video/');
        let mediaType = isVideo ? 'video' : 'photo';
        if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
            mediaType = 'document';
        }
        await connection.query(`
          INSERT INTO cm_fund_update_media (update_id, media_type, file_url, file_name)
          VALUES (?, ?, ?, ?)
        `, [updateId, mediaType, fileUrl, file.originalname]);
      }
    }

    // Update Application Status if changed
    let oldStatus = application.status;
    if (type !== application.status) {
      await connection.query(`UPDATE cm_fund_requests SET status = ?, updated_by_admin_id = ? WHERE id = ?`, [type, req.admin?.id || null, id]);
      
      // Log Status Change Timeline Event
      await connection.query(`
        INSERT INTO cm_fund_timeline_events (request_id, event_type, from_status, to_status, actor_id, note)
        VALUES (?, 'Status Updated', ?, ?, ?, ?)
      `, [id, oldStatus, type, req.admin ? req.admin.id : null, `Status changed via Follow-up Update: ${title}`]);
    } else {
      // Just log an update event
      await connection.query(`
        INSERT INTO cm_fund_timeline_events (request_id, event_type, to_status, actor_id, note)
        VALUES (?, 'Follow-up Added', ?, ?, ?)
      `, [id, type, req.admin ? req.admin.id : null, title]);
    }

    await connection.commit();

    // Send SMS Notification
    if (isNotify && application.applicant_phone) {
      const smsMessage = custom_sms_message || followUpUpdateSMS({
        name: application.applicant_name,
        referenceNo: id,
        statusTitle: title,
        moduleLabel: 'Application',
        updateDate: new Date(),
      });

      sendSMSSafe(application.applicant_phone, smsMessage);
    }

    auditLog(req, { action: 'Updated', module: 'CM Funds', details: `Added follow-up to Application ${id}`, resource: `cm-funds/${id}`, severity: 'info' });

    res.status(201).json({ message: 'Update added successfully', updateId });
  } catch (err) {
    await connection.rollback();
    console.error('Error adding update:', err);
    res.status(500).json({ error: 'Failed to add update' });
  } finally {
    connection.release();
  }
};

export const editUpdate = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id, updateId } = req.params;
    const { type, title, note, retained_media_ids } = req.body;

    await connection.beginTransaction();

    await connection.query(
      'UPDATE cm_fund_updates SET type = ?, title = ?, note = ? WHERE id = ? AND request_id = ?',
      [type, title, note || null, updateId, id]
    );

    let retainedMedia = [];
    try { if (retained_media_ids) retainedMedia = JSON.parse(retained_media_ids); } catch(e){}

    const [currentMedia] = await connection.query('SELECT id, file_url FROM cm_fund_update_media WHERE update_id = ?', [updateId]);
    const mediaToDelete = currentMedia.filter(m => !retainedMedia.includes(m.id));
    if (mediaToDelete.length > 0) {
      const idsToDelete = mediaToDelete.map(m => m.id);
      await Promise.all(mediaToDelete.map(m => deleteS3Object(m.file_url)));
      await connection.query('DELETE FROM cm_fund_update_media WHERE id IN (?)', [idsToDelete]);
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileUrl = file.location || `/uploads/cm_fund_documents/${file.filename}`;
        const isVideo = file.mimetype.startsWith('video/');
        let mediaType = isVideo ? 'video' : 'photo';
        if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
            mediaType = 'document';
        }
        await connection.query(`
          INSERT INTO cm_fund_update_media (update_id, media_type, file_url, file_name)
          VALUES (?, ?, ?, ?)
        `, [updateId, mediaType, fileUrl, file.originalname]);
      }
    }

    await connection.query(`
      INSERT INTO cm_fund_timeline_events (request_id, event_type, actor_id, note)
      VALUES (?, 'Update Edited', ?, ?)
    `, [id, req.admin ? req.admin.id : null, `Follow-up updated: ${title}`]);

    await connection.commit();
    auditLog(req, { action: 'Updated', module: 'CM Funds', details: `Edited follow-up on Application ${id}`, resource: `cm-funds/${id}`, severity: 'info' });
    res.json({ message: 'Update edited successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('Error editing update:', err);
    res.status(500).json({ error: 'Failed to edit update' });
  } finally {
    connection.release();
  }
};

export const deleteUpdate = async (req, res) => {
  try {
    const { id, updateId } = req.params;
    const [result] = await pool.query('DELETE FROM cm_fund_updates WHERE id = ? AND request_id = ?', [updateId, id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Update not found' });
    }

    auditLog(req, { action: 'Deleted', module: 'CM Funds', details: `Deleted follow-up ${updateId} from Application ${id}`, resource: `cm-funds/${id}`, severity: 'warning' });
    res.json({ message: 'Update deleted successfully' });
  } catch (err) {
    console.error('Error deleting update:', err);
    res.status(500).json({ error: 'Failed to delete update' });
  }
};
