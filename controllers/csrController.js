import db from '../configs/db.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { logActivity as auditLog } from './teamsLogController.js';
import { broadcastNotification } from '../utils/notificationHelper.js';

// ── Internal helper ────────────────────────────────────────────
const safeJsonStringify = (val, fallback = '[]') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') {
        try {
            JSON.parse(val);
            return val;
        } catch {
            return JSON.stringify(val);
        }
    }
    try {
        return JSON.stringify(val);
    } catch {
        return fallback;
    }
};

const logActivity = async (connection, user_name, action) => {
    const finalUserName = user_name || 'Admin';
    const words = finalUserName.trim().split(/\s+/);
    const initials = words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : finalUserName.slice(0, 2).toUpperCase();
    await connection.query(
        `INSERT INTO csr_activities (user_name, action, time_label, initials)
         VALUES (?, ?, 'Just now', ?)`,
        [finalUserName, action, initials]
    );
};

// ── GET /api/csr/stats ─────────────────────────────────────────
export const getCSRStats = async (req, res) => {
    try {
        const [[orgRow]] = await db.query(`
            SELECT
                COUNT(*)                                        AS totalOrgs,
                SUM(status = 'Active')                          AS activePartners,
                COALESCE(SUM(contribution), 0)                  AS totalContributions
            FROM csr_organisations WHERE deleted = 0
        `);
        const [[{ pendingFollowups }]] = await db.query(
            `SELECT COUNT(*) AS pendingFollowups FROM csr_followups WHERE status = 'Scheduled'`
        );
        const [[{ reportsSent }]] = await db.query(
            `SELECT COUNT(*) AS reportsSent FROM csr_reports`
        );
        const totalContributions = Number(orgRow.totalContributions) || 0;
        return successResponse(res, {
            data: {
                totalOrgs: Number(orgRow.totalOrgs),
                activePartners: Number(orgRow.activePartners),
                pendingFollowups: Number(pendingFollowups),
                reportsSent: Number(reportsSent),
                totalContributions,
                fundsUtilised: Math.round(totalContributions * 0.67),
            }
        }, 'Stats fetched.');
    } catch (err) {
        console.error('[getCSRStats]', err);
        return errorResponse(res, 'Server error fetching CSR stats.');
    }
};

// ── GET /api/csr/organisations ─────────────────────────────────
export const getCSROrganisations = async (req, res) => {
    try {
        const { search, status, domain, district } = req.query;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;

        const conds = ['o.deleted = 0'];
        const vals  = [];

        if (search) {
            conds.push('(o.name LIKE ? OR o.responsible_person LIKE ? OR o.email LIKE ? OR o.phone LIKE ?)');
            const q = `%${search}%`;
            vals.push(q, q, q, q);
        }
        if (status && status !== 'All') { conds.push('o.status = ?'); vals.push(status); }
        if (district && district !== 'All') { conds.push('o.district = ?'); vals.push(district); }
        if (domain && domain !== 'All') {
            conds.push('JSON_CONTAINS(o.domains, ?)');
            vals.push(JSON.stringify(domain));
        }

        const where = `WHERE ${conds.join(' AND ')}`;
        const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM csr_organisations o ${where}`, vals);
        const [rows] = await db.query(
            `SELECT o.* FROM csr_organisations o ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
            [...vals, limit, offset]
        );
        rows.forEach(r => {
            r.domains = typeof r.domains === 'string' ? JSON.parse(r.domains || '[]') : (r.domains || []);
            r.documents = typeof r.documents === 'string' ? JSON.parse(r.documents || '[]') : (r.documents || []);
            r.section_80g = Boolean(r.section_80g);
            r.fcra_registered = Boolean(r.fcra_registered);
            r.csr_policy = Boolean(r.csr_policy);
        });

        return successResponse(res, { data: { data: rows, total: Number(total) } }, 'Organisations fetched.');
    } catch (err) {
        console.error('[getCSROrganisations]', err);
        return errorResponse(res, 'Server error fetching organisations.');
    }
};

// ── GET /api/csr/organisations/:id ────────────────────────────
export const getCSROrganisationById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            `SELECT o.*, 
                    cr_u.full_name AS created_by_name,
                    up_u.full_name AS updated_by_name
             FROM csr_organisations o
             LEFT JOIN admin_users cr_u ON cr_u.id = o.created_by
             LEFT JOIN admin_users up_u ON up_u.id = o.updated_by
             WHERE o.id = ? AND o.deleted = 0`,
            [id]
        );
        if (!rows.length) return errorResponse(res, 'Organisation not found.', 404);
        const org = rows[0];
        org.domains = typeof org.domains === 'string' ? JSON.parse(org.domains || '[]') : (org.domains || []);
        org.documents = typeof org.documents === 'string' ? JSON.parse(org.documents || '[]') : (org.documents || []);
        org.section_80g = Boolean(org.section_80g);
        org.fcra_registered = Boolean(org.fcra_registered);
        org.csr_policy = Boolean(org.csr_policy);
        const [contacts] = await db.query(
            'SELECT * FROM csr_organisation_contacts WHERE org_id = ? ORDER BY is_primary DESC, id ASC',
            [id]
        );
        org.contacts = contacts.map(c => ({
            ...c,
            is_primary: Boolean(c.is_primary)
        }));
        return successResponse(res, { data: { data: org } }, 'Organisation fetched.');
    } catch (err) {
        console.error('[getCSROrganisationById]', err);
        return errorResponse(res, 'Server error.');
    }
};

// ── POST /api/csr/organisations ────────────────────────────────
export const createCSROrganisation = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const {
            name, type, responsible_person, phone, email, domains = [],
            contribution = 0, status = 'Active', district,
            registration_no, website, office_address, annual_budget,
            assigned_to, next_followup, internal_notes, contacts = [],
            section_80g = 0, fcra_registered = 0, csr_policy = 0,
            documents = [], attachments = []
        } = req.body;

        if (!name?.trim()) return errorResponse(res, 'Organisation name is required.', 400);

        const adminId = req.admin ? req.admin.id : null;

        await conn.beginTransaction();

        const domainsJson = JSON.stringify(Array.isArray(domains) ? domains : []);
        const docList = Array.isArray(documents) && documents.length > 0 ? documents : (Array.isArray(attachments) ? attachments : []);
        const docsJson = JSON.stringify(docList);
        const [result] = await conn.query(
            `INSERT INTO csr_organisations
             (name, type, responsible_person, phone, email, domains, contribution, status,
              district, registration_no, website, office_address, annual_budget,
              assigned_to, next_followup, internal_notes, last_followup,
              section_80g, fcra_registered, csr_policy, documents,
              created_by, updated_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURDATE(),?,?,?,?,?,?)`,
            [name.trim(), type||null, responsible_person||null, phone||null, email||null,
             domainsJson, Number(contribution)||0, status,
             district||null, registration_no||null, website||null, office_address||null,
             annual_budget ? Number(annual_budget) : null,
             assigned_to||null, next_followup||null, internal_notes||null,
             section_80g ? 1 : 0, fcra_registered ? 1 : 0, csr_policy ? 1 : 0, docsJson,
             adminId, adminId]
        );
        const orgId = result.insertId;

        if (contacts.length) {
            const contactVals = contacts
                .filter(c => c.name || c.phone || c.email)
                .map(c => [
                    orgId,
                    c.name || null,
                    c.phone || null,
                    c.alternate_phone || null,
                    c.email || null,
                    c.alternate_email || null,
                    c.designation || null,
                    c.remarks || null,
                    c.is_primary ? 1 : 0
                ]);
            if (contactVals.length) {
                await conn.query(
                    'INSERT INTO csr_organisation_contacts (org_id, name, phone, alternate_phone, email, alternate_email, designation, remarks, is_primary) VALUES ?',
                    [contactVals]
                );
            }
        }

        await logActivity(conn, req.admin?.full_name, `added new organisation '${name.trim()}'`);
        await conn.commit();

        auditLog(req, { action: 'Created', module: 'CSR', details: `CSR Organisation "${name.trim()}" created`, resource: `csr/organisations/${orgId}`, severity: 'success' });
        broadcastNotification({ type: 'CSR_ORG_CREATED', title: 'New CSR Organisation', message: `${name.trim()} was added.`, link: `/admin/csr/organisations/${orgId}` });

        const [newRows] = await db.query(
            `SELECT o.*, 
                    cr_u.full_name AS created_by_name,
                    up_u.full_name AS updated_by_name
             FROM csr_organisations o
             LEFT JOIN admin_users cr_u ON o.created_by = cr_u.id
             LEFT JOIN admin_users up_u ON o.updated_by = up_u.id
             WHERE o.id = ?`,
            [orgId]
        );
        const org = newRows[0];
        org.domains = typeof org.domains === 'string' ? JSON.parse(org.domains || '[]') : (org.domains || []);
        org.documents = typeof org.documents === 'string' ? JSON.parse(org.documents || '[]') : (org.documents || []);
        org.section_80g = Boolean(org.section_80g);
        org.fcra_registered = Boolean(org.fcra_registered);
        org.csr_policy = Boolean(org.csr_policy);
        const [newContacts] = await db.query(
            'SELECT * FROM csr_organisation_contacts WHERE org_id = ? ORDER BY is_primary DESC, id ASC',
            [orgId]
        );
        org.contacts = newContacts.map(c => ({ ...c, is_primary: Boolean(c.is_primary) }));

        return successResponse(res, { data: { data: org } }, 'Organisation created.', 201);
    } catch (err) {
        await conn.rollback();
        console.error('[createCSROrganisation]', err);
        return errorResponse(res, 'Server error creating organisation.');
    } finally {
        conn.release();
    }
};

// ── PUT /api/csr/organisations/:id ────────────────────────────
export const updateCSROrganisation = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const {
            name, type, responsible_person, phone, email, domains = [],
            contribution, status, district, registration_no, website,
            office_address, annual_budget, assigned_to, next_followup,
            internal_notes, contacts = [],
            section_80g, fcra_registered, csr_policy,
            documents, attachments
        } = req.body;

        if (!name?.trim()) return errorResponse(res, 'Organisation name is required.', 400);

        const [check] = await db.query('SELECT id, section_80g, fcra_registered, csr_policy, documents, domains FROM csr_organisations WHERE id = ? AND deleted = 0', [id]);
        if (!check.length) return errorResponse(res, 'Organisation not found.', 404);

        const existing = check[0];
        const adminId = req.admin ? req.admin.id : null;

        await conn.beginTransaction();

        const domainsJson = domains !== undefined ? safeJsonStringify(domains, '[]') : safeJsonStringify(existing.domains, '[]');
        const docList = documents !== undefined ? documents : (attachments !== undefined ? attachments : existing.documents);
        const docsJson = safeJsonStringify(docList, '[]');

        const sec80gVal = section_80g !== undefined ? (section_80g ? 1 : 0) : existing.section_80g;
        const fcraVal = fcra_registered !== undefined ? (fcra_registered ? 1 : 0) : existing.fcra_registered;
        const csrPolicyVal = csr_policy !== undefined ? (csr_policy ? 1 : 0) : existing.csr_policy;

        await conn.query(
            `UPDATE csr_organisations SET
             name=?, type=?, responsible_person=?, phone=?, email=?, domains=?,
             contribution=?, status=?, district=?, registration_no=?, website=?,
             office_address=?, annual_budget=?, assigned_to=?, next_followup=?,
             internal_notes=?,
             section_80g=?, fcra_registered=?, csr_policy=?, documents=?,
             updated_by=?, updated_at=NOW()
             WHERE id=?`,
            [name.trim(), type||null, responsible_person||null, phone||null, email||null,
             domainsJson, contribution !== undefined ? Number(contribution) : 0, status||'Active',
             district||null, registration_no||null, website||null, office_address||null,
             annual_budget ? Number(annual_budget) : null,
             assigned_to||null, next_followup||null, internal_notes||null,
             sec80gVal, fcraVal, csrPolicyVal, docsJson,
             adminId, id]
        );

        // Replace contacts
        await conn.query('DELETE FROM csr_organisation_contacts WHERE org_id = ?', [id]);
        if (contacts.length) {
            const contactVals = contacts
                .filter(c => c.name || c.phone || c.email)
                .map(c => [
                    id,
                    c.name || null,
                    c.phone || null,
                    c.alternate_phone || null,
                    c.email || null,
                    c.alternate_email || null,
                    c.designation || null,
                    c.remarks || null,
                    c.is_primary ? 1 : 0
                ]);
            if (contactVals.length) {
                await conn.query(
                    'INSERT INTO csr_organisation_contacts (org_id, name, phone, alternate_phone, email, alternate_email, designation, remarks, is_primary) VALUES ?',
                    [contactVals]
                );
            }
        }

        await logActivity(conn, req.admin?.full_name, `updated details for '${name.trim()}'`);
        await conn.commit();

        auditLog(req, { action: 'Updated', module: 'CSR', details: `CSR Organisation ID ${id} updated — "${name.trim()}"`, resource: `csr/organisations/${id}`, severity: 'success' });
        const [updRows] = await db.query(
            `SELECT o.*, 
                    cr_u.full_name AS created_by_name,
                    up_u.full_name AS updated_by_name
             FROM csr_organisations o
             LEFT JOIN admin_users cr_u ON cr_u.id = o.created_by
             LEFT JOIN admin_users up_u ON up_u.id = o.updated_by
             WHERE o.id = ?`,
            [id]
        );
        const org = updRows[0];
        org.domains = typeof org.domains === 'string' ? JSON.parse(org.domains || '[]') : (org.domains || []);
        org.documents = typeof org.documents === 'string' ? JSON.parse(org.documents || '[]') : (org.documents || []);
        org.section_80g = Boolean(org.section_80g);
        org.fcra_registered = Boolean(org.fcra_registered);
        org.csr_policy = Boolean(org.csr_policy);
        const [updContacts] = await db.query(
            'SELECT * FROM csr_organisation_contacts WHERE org_id = ? ORDER BY is_primary DESC, id ASC',
            [id]
        );
        org.contacts = updContacts.map(c => ({ ...c, is_primary: Boolean(c.is_primary) }));

        return successResponse(res, { data: { data: org } }, 'Organisation updated.');
    } catch (err) {
        await conn.rollback();
        console.error('[updateCSROrganisation]', err);
        return errorResponse(res, 'Server error updating organisation.');
    } finally {
        conn.release();
    }
};

// ── POST /api/csr/upload (admin) ──────────────────────────────
export const uploadCSRDocument = async (req, res) => {
    try {
        const { uploadDocument, runMulter } = await import('../configs/multerS3.js');
        await runMulter(uploadDocument, req, res);
        if (!req.file) return errorResponse(res, 'No file provided.', 400);
        return successResponse(res, {
            url: req.file.location || `/uploads/${req.file.filename}`,
            name: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        }, 'Document uploaded.');
    } catch (err) {
        console.error('[uploadCSRDocument]', err);
        if (err.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'File too large (max 20 MB).', 413);
        return errorResponse(res, err.message || 'Upload failed.');
    }
};

// ── DELETE /api/csr/organisations/:id (soft) ──────────────────
export const softDeleteCSROrganisation = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT name FROM csr_organisations WHERE id = ? AND deleted = 0', [id]);
        if (!rows.length) return errorResponse(res, 'Organisation not found.', 404);

        await conn.beginTransaction();
        await conn.query(
            'UPDATE csr_organisations SET deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
            [req.admin?.id || null, id]
        );
        await logActivity(conn, req.admin?.full_name, `moved '${rows[0].name}' to trash`);
        await conn.commit();
        auditLog(req, { action: 'Archived', module: 'CSR', details: `CSR Organisation ID ${id} moved to trash — "${rows[0].name}"`, resource: `csr/organisations/${id}`, severity: 'warning' });
        return successResponse(res, { data: { success: true } }, 'Organisation moved to trash.');
    } catch (err) {
        await conn.rollback();
        console.error('[softDeleteCSROrganisation]', err);
        return errorResponse(res, 'Server error.');
    } finally {
        conn.release();
    }
};

// ── GET /api/csr/trash ─────────────────────────────────────────
export const getCSRTrash = async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT o.*, au.full_name AS deleted_by_name
             FROM csr_organisations o
             LEFT JOIN admin_users au ON au.id = o.deleted_by
             WHERE o.deleted = 1
             ORDER BY o.deleted_at DESC`
        );
        rows.forEach(r => { try { r.domains = JSON.parse(r.domains || '[]'); } catch { r.domains = []; } });
        return successResponse(res, { data: { data: rows } }, 'Trash fetched.');
    } catch (err) {
        console.error('[getCSRTrash]', err);
        return errorResponse(res, 'Server error fetching trash.');
    }
};

// ── POST /api/csr/organisations/:id/restore ───────────────────
export const restoreCSROrganisation = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT name FROM csr_organisations WHERE id = ? AND deleted = 1', [id]);
        if (!rows.length) return errorResponse(res, 'Organisation not found in trash.', 404);

        await conn.beginTransaction();
        await conn.query(
            'UPDATE csr_organisations SET deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?', [id]
        );
        await logActivity(conn, req.admin?.full_name, `restored '${rows[0].name}' from trash`);
        await conn.commit();
        auditLog(req, { action: 'Updated', module: 'CSR', details: `CSR Organisation ID ${id} restored from trash`, resource: `csr/organisations/${id}`, severity: 'info' });
        return successResponse(res, { data: { success: true } }, 'Organisation restored.');
    } catch (err) {
        await conn.rollback();
        console.error('[restoreCSROrganisation]', err);
        return errorResponse(res, 'Server error.');
    } finally {
        conn.release();
    }
};

// ── DELETE /api/csr/organisations/:id/permanent ───────────────
export const permanentDeleteCSROrganisation = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT name FROM csr_organisations WHERE id = ?', [id]);
        if (!rows.length) return errorResponse(res, 'Organisation not found.', 404);

        await conn.beginTransaction();
        await conn.query('DELETE FROM csr_organisations WHERE id = ?', [id]);
        await logActivity(conn, req.admin?.full_name, `permanently deleted '${rows[0].name}'`);
        await conn.commit();
        auditLog(req, { action: 'Deleted', module: 'CSR', details: `CSR Organisation ID ${id} permanently deleted — "${rows[0].name}"`, resource: `csr/organisations/${id}`, severity: 'error' });
        return successResponse(res, { data: { success: true } }, 'Organisation permanently deleted.');
    } catch (err) {
        await conn.rollback();
        console.error('[permanentDeleteCSROrganisation]', err);
        return errorResponse(res, 'Server error.');
    } finally {
        conn.release();
    }
};

// ── POST /api/csr/organisations/:id/log-call ──────────────────
export const logCSRCall = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const [rows] = await db.query('SELECT name FROM csr_organisations WHERE id = ? AND deleted = 0', [id]);
        if (!rows.length) return errorResponse(res, 'Organisation not found.', 404);

        await conn.beginTransaction();
        await conn.query('UPDATE csr_organisations SET last_followup = CURDATE() WHERE id = ?', [id]);
        await logActivity(conn, req.admin?.full_name, `logged a call with '${rows[0].name}'`);
        await conn.commit();
        return successResponse(res, { data: { success: true } }, 'Call logged.');
    } catch (err) {
        await conn.rollback();
        console.error('[logCSRCall]', err);
        return errorResponse(res, 'Server error.');
    } finally {
        conn.release();
    }
};

// ── POST /api/csr/organisations/:id/log-email ─────────────────
export const logCSREmail = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT name FROM csr_organisations WHERE id = ? AND deleted = 0', [id]);
        if (!rows.length) return errorResponse(res, 'Organisation not found.', 404);

        await conn.beginTransaction();
        await conn.query('UPDATE csr_organisations SET last_followup = CURDATE() WHERE id = ?', [id]);
        await logActivity(conn, req.admin?.full_name, `sent email to '${rows[0].name}'`);
        await conn.commit();
        return successResponse(res, { data: { success: true } }, 'Email logged.');
    } catch (err) {
        await conn.rollback();
        console.error('[logCSREmail]', err);
        return errorResponse(res, 'Server error.');
    } finally {
        conn.release();
    }
};

// ── GET /api/csr/followups ────────────────────────────────────
export const getCSRFollowups = async (req, res) => {
    try {
        const { org_id, status } = req.query;
        const conds = [];
        const vals  = [];
        if (org_id)  { conds.push('org_id = ?');  vals.push(org_id); }
        if (status)  { conds.push('status = ?');   vals.push(status); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const [rows] = await db.query(`SELECT * FROM csr_followups ${where} ORDER BY date ASC`, vals);
        return successResponse(res, { data: { data: rows } }, 'Followups fetched.');
    } catch (err) {
        console.error('[getCSRFollowups]', err);
        return errorResponse(res, 'Server error fetching followups.');
    }
};

// ── POST /api/csr/followups ───────────────────────────────────
export const createCSRFollowup = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const {
            org_id, org_name, date, type = 'Call', notes,
            sent_by, notify_email = 0, notify_sms = 0, notify_whatsapp = 0
        } = req.body;
        if (!org_id || !date) return errorResponse(res, 'org_id and date are required.', 400);

        const initials = org_name
            ? org_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
            : 'CF';

        await conn.beginTransaction();
        const [result] = await conn.query(
            `INSERT INTO csr_followups
             (org_id, org_name, date, type, notes, sent_by, notify_email, notify_sms, notify_whatsapp, initials, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,'Scheduled')`,
            [org_id, org_name||null, date, type, notes||null, sent_by||null,
             notify_email?1:0, notify_sms?1:0, notify_whatsapp?1:0, initials]
        );
        await conn.query(
            'UPDATE csr_organisations SET next_followup = ? WHERE id = ?', [date, org_id]
        );
        await logActivity(conn, req.admin?.full_name, `scheduled follow-up with '${org_name}'`);
        await conn.commit();

        const [rows] = await db.query('SELECT * FROM csr_followups WHERE id = ?', [result.insertId]);
        // Notify all admins of scheduled followup
        broadcastNotification({
          title: `CSR Follow-up Scheduled: ${org_name || 'Organisation'}`,
          message: `A ${type} follow-up with "${org_name || 'a CSR partner'}" is scheduled for ${date}.`,
          type: 'csr', module: 'CSR',
          link_path: `/mlaconnect/csr`,
        });
        return successResponse(res, { data: { data: rows[0] } }, 'Followup created.', 201);
    } catch (err) {
        await conn.rollback();
        console.error('[createCSRFollowup]', err);
        return errorResponse(res, 'Server error creating followup.');
    } finally {
        conn.release();
    }
};

// ── GET /api/csr/activities ───────────────────────────────────
export const getCSRActivities = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM csr_activities ORDER BY created_at DESC LIMIT 50'
        );
        const mapped = rows.map(r => ({
            id: r.id,
            user_name: r.user_name || 'Admin',
            user: r.user_name || 'Admin',
            author_name: r.user_name || 'Admin',
            action: r.action,
            text: r.action,
            time_label: r.time_label || 'Just now',
            time: r.created_at,
            created_at: r.created_at,
            initials: r.initials || (r.user_name ? r.user_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'AD')
        }));
        return successResponse(res, { data: { data: mapped } }, 'Activities fetched.');
    } catch (err) {
        console.error('[getCSRActivities]', err);
        return errorResponse(res, 'Server error fetching activities.');
    }
};

// ── POST /api/csr/activities (internal) ───────────────────────
export const createCSRActivity = async (req, res) => {
    try {
        const { user_name, action, time_label, initials } = req.body;
        if (!action) return errorResponse(res, 'action is required.', 400);
        const [result] = await db.query(
            'INSERT INTO csr_activities (user_name, action, time_label, initials) VALUES (?,?,?,?)',
            [user_name||null, action, time_label||'Just now', initials||null]
        );
        const [rows] = await db.query('SELECT * FROM csr_activities WHERE id = ?', [result.insertId]);
        return successResponse(res, { data: { data: rows[0] } }, 'Activity logged.', 201);
    } catch (err) {
        console.error('[createCSRActivity]', err);
        return errorResponse(res, 'Server error.');
    }
};

// ── GET /api/csr/reports ──────────────────────────────────────
export const getCSRReports = async (req, res) => {
    try {
        const { status } = req.query;
        const conds = [];
        const vals  = [];
        if (status && status !== 'All') { conds.push('status = ?'); vals.push(status); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const [rows] = await db.query(
            `SELECT * FROM csr_reports ${where} ORDER BY created_at DESC`, vals
        );
        rows.forEach(r => {
            ['projects_list','org_list','recipient_list','attachment_list'].forEach(f => {
                try { r[f] = JSON.parse(r[f] || 'null') || []; } catch { r[f] = []; }
            });
        });
        return successResponse(res, { data: { data: rows } }, 'Reports fetched.');
    } catch (err) {
        console.error('[getCSRReports]', err);
        return errorResponse(res, 'Server error fetching reports.');
    }
};

// ── GET /api/csr/reports/:id ──────────────────────────────────
export const getCSRReportById = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM csr_reports WHERE id = ?', [req.params.id]);
        if (!rows.length) return errorResponse(res, 'Report not found.', 404);
        const r = rows[0];
        ['projects_list','org_list','recipient_list','attachment_list'].forEach(f => {
            try { r[f] = JSON.parse(r[f] || 'null') || []; } catch { r[f] = []; }
        });
        const [attachments] = await db.query(
            'SELECT * FROM csr_report_attachments WHERE report_id = ?', [r.id]
        );
        r.attachments = attachments;
        return successResponse(res, { data: { data: r } }, 'Report fetched.');
    } catch (err) {
        console.error('[getCSRReportById]', err);
        return errorResponse(res, 'Server error.');
    }
};

// ── POST /api/csr/reports ─────────────────────────────────────
export const createCSRReport = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const {
            org_id, org_name, type, title, sent_by, sent_by_id,
            message, special_notes, status = 'Sent', scheduled_at,
            projects_count = 0, orgs_count = 0, recipients_count = 0, attachments_count = 0,
            projects_list = [], org_list = [], recipient_list = [], attachment_list = []
        } = req.body;

        if (!title?.trim()) return errorResponse(res, 'Title is required.', 400);
        if (!type?.trim())  return errorResponse(res, 'Type is required.', 400);
        if (status === 'Scheduled' && !scheduled_at)
            return errorResponse(res, 'scheduled_at is required when status is Scheduled.', 400);

        await conn.beginTransaction();
        const today = new Date().toISOString().split('T')[0];
        const timeNow = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

        const [result] = await conn.query(
            `INSERT INTO csr_reports
             (org_id, org_name, type, title, sent_by, sent_by_id, message, special_notes,
              status, scheduled_at, date_sent, time_sent,
              projects_count, orgs_count, recipients_count, attachments_count,
              projects_list, org_list, recipient_list, attachment_list)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [org_id||null, org_name||null, type.trim(), title.trim(),
             sent_by||null, sent_by_id||null, message||null, special_notes||null,
             status, scheduled_at||null, today, timeNow,
             Number(projects_count), Number(orgs_count), Number(recipients_count), Number(attachments_count),
             JSON.stringify(projects_list), JSON.stringify(org_list),
             JSON.stringify(recipient_list), JSON.stringify(attachment_list)]
        );

        const reportId = result.insertId;
        const adminName = sent_by || req.admin?.full_name || 'MLA Cell';
        await logActivity(conn, adminName, `sent ${type.toLowerCase()} to ${org_name || 'multiple organisations'}`);
        await conn.commit();

        const [rows] = await db.query('SELECT * FROM csr_reports WHERE id = ?', [reportId]);
        const report = rows[0];
        ['projects_list','org_list','recipient_list','attachment_list'].forEach(f => {
            try { report[f] = JSON.parse(report[f] || 'null') || []; } catch { report[f] = []; }
        });
        return successResponse(res, { data: { data: report } }, 'Report created.', 201);
    } catch (err) {
        await conn.rollback();
        console.error('[createCSRReport]', err);
        return errorResponse(res, 'Server error creating report.');
    } finally {
        conn.release();
    }
};

// ── PUT /api/csr/reports/:id ──────────────────────────────────
export const updateCSRReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, type, message, status, scheduled_at } = req.body;
        const [check] = await db.query('SELECT id FROM csr_reports WHERE id = ?', [id]);
        if (!check.length) return errorResponse(res, 'Report not found.', 404);

        await db.query(
            `UPDATE csr_reports SET
             title=COALESCE(?,title), type=COALESCE(?,type), message=COALESCE(?,message),
             status=COALESCE(?,status), scheduled_at=COALESCE(?,scheduled_at)
             WHERE id=?`,
            [title||null, type||null, message||null, status||null, scheduled_at||null, id]
        );
        const [rows] = await db.query('SELECT * FROM csr_reports WHERE id = ?', [id]);
        const r = rows[0];
        ['projects_list','org_list','recipient_list','attachment_list'].forEach(f => {
            try { r[f] = JSON.parse(r[f] || 'null') || []; } catch { r[f] = []; }
        });
        return successResponse(res, { data: { data: r } }, 'Report updated.');
    } catch (err) {
        console.error('[updateCSRReport]', err);
        return errorResponse(res, 'Server error updating report.');
    }
};

// ── DELETE /api/csr/reports/:id ───────────────────────────────
export const deleteCSRReport = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id FROM csr_reports WHERE id = ?', [req.params.id]);
        if (!rows.length) return errorResponse(res, 'Report not found.', 404);
        await db.query('DELETE FROM csr_reports WHERE id = ?', [req.params.id]);
        return successResponse(res, { data: { success: true } }, 'Report deleted.');
    } catch (err) {
        console.error('[deleteCSRReport]', err);
        return errorResponse(res, 'Server error deleting report.');
    }
};
