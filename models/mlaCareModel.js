import pool from '../configs/db.js';

const VALID_STATUSES = new Set(['Pending', 'Verified', 'Approved', 'Rejected']);

const rowToApplication = (r) => ({
    id: r.id,
    refNo: r.ref_no,
    patientName: r.patient_name,
    phone: r.phone,
    careCategory: r.care_category,
    localBodyId: r.local_body_id,
    localBody: r.local_body_name || r.local_body || '',
    wardId: r.ward_id,
    ward: r.ward || '',
    houseName: r.house_name,
    medicalDetails: r.medical_details,
    documentUrl: r.document_url,
    documentName: r.document_name,
    consentGiven: !!r.consent_given,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
});

/**
 * Fetch all MLA Care applications with optional filters + pagination.
 * Also returns a category counts object for the admin tabs.
 */
export const fetchAllApplications = async ({ search, status, localBodyId, category, page = 1, limit = 15 } = {}) => {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 15, 100);
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];

    if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`;
        where.push(`(a.ref_no LIKE ? OR a.patient_name LIKE ? OR a.phone LIKE ? OR lb.name LIKE ? OR COALESCE(a.house_name,'') LIKE ?)`);
        params.push(q, q, q, q, q);
    }

    if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        const valid = statuses.filter((s) => VALID_STATUSES.has(s));
        if (valid.length > 0) {
            where.push(`a.status IN (${valid.map(() => '?').join(',')})`);
            params.push(...valid);
        }
    }

    if (localBodyId) {
        where.push('a.local_body_id = ?');
        params.push(parseInt(localBodyId, 10));
    }

    if (category && String(category).trim() !== 'All') {
        where.push('a.care_category = ?');
        params.push(String(category).trim());
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const selectSql = `
        SELECT
            a.*,
            lb.name AS local_body_name,
            CONCAT('Ward ', w.ward_no, COALESCE(CONCAT(' - ', w.place_name), '')) AS ward
        FROM mla_care_applications a
        LEFT JOIN local_bodies lb ON a.local_body_id = lb.id
        LEFT JOIN local_body_wards w ON a.ward_id = w.id
        ${whereSql}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    `;

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM mla_care_applications a LEFT JOIN local_bodies lb ON a.local_body_id = lb.id ${whereSql}`,
        params
    );

    const [rows] = await pool.query(selectSql, [...params, limitNum, offset]);

    const [[{ categoryRows }]] = await pool.query(
        `SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('category', c.care_category, 'count', c.cnt)), JSON_ARRAY()) AS categoryRows
         FROM (SELECT care_category, COUNT(*) AS cnt FROM mla_care_applications GROUP BY care_category) c`
    );

    const counts = { All: total };
    (categoryRows || []).forEach(({ category, count }) => {
        counts[category] = count;
    });

    return {
        data: rows.map(rowToApplication),
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            counts,
        },
    };
};

/**
 * Fetch a single MLA Care application by id.
 */
export const fetchApplicationById = async (id) => {
    const [rows] = await pool.query(
        `SELECT
            a.*,
            lb.name AS local_body_name,
            CONCAT('Ward ', w.ward_no, COALESCE(CONCAT(' - ', w.place_name), '')) AS ward
         FROM mla_care_applications a
         LEFT JOIN local_bodies lb ON a.local_body_id = lb.id
         LEFT JOIN local_body_wards w ON a.ward_id = w.id
         WHERE a.id = ?`,
        [id]
    );
    return rows.length ? rowToApplication(rows[0]) : null;
};

/**
 * Insert a new MLA Care application and generate its ref_no.
 * ref_no format: MC-<zero-padded id> (e.g. MC-0042).
 */
export const insertApplication = async (data) => {
    const [result] = await pool.query(
        `INSERT INTO mla_care_applications
            (ref_no, patient_name, phone, care_category, local_body_id, ward_id, house_name, medical_details, document_url, document_name, consent_given, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            '',
            data.patientName,
            data.phone,
            data.careCategory,
            data.localBodyId ? parseInt(data.localBodyId, 10) : null,
            data.wardId ? parseInt(data.wardId, 10) : null,
            data.houseName || null,
            data.medicalDetails || null,
            data.documentUrl || null,
            data.documentName || null,
            data.consentGiven ? 1 : 0,
            data.status || 'Pending',
        ]
    );

    const id = result.insertId;
    const refNo = `MC-${String(id).padStart(3, '0')}`;
    await pool.query('UPDATE mla_care_applications SET ref_no = ? WHERE id = ?', [refNo, id]);

    return fetchApplicationById(id);
};

/**
 * Update an existing MLA Care application (partial update).
 */
export const updateApplicationById = async (id, data) => {
    const fields = [];
    const values = [];

    if (data.patientName !== undefined) {
        fields.push('patient_name = ?');
        values.push(data.patientName);
    }
    if (data.phone !== undefined) {
        fields.push('phone = ?');
        values.push(data.phone);
    }
    if (data.careCategory !== undefined) {
        fields.push('care_category = ?');
        values.push(data.careCategory);
    }
    if (data.localBodyId !== undefined) {
        fields.push('local_body_id = ?');
        values.push(data.localBodyId ? parseInt(data.localBodyId, 10) : null);
    }
    if (data.wardId !== undefined) {
        fields.push('ward_id = ?');
        values.push(data.wardId ? parseInt(data.wardId, 10) : null);
    }
    if (data.houseName !== undefined) {
        fields.push('house_name = ?');
        values.push(data.houseName || null);
    }
    if (data.medicalDetails !== undefined) {
        fields.push('medical_details = ?');
        values.push(data.medicalDetails || null);
    }
    if (data.documentUrl !== undefined) {
        fields.push('document_url = ?');
        values.push(data.documentUrl || null);
    }
    if (data.documentName !== undefined) {
        fields.push('document_name = ?');
        values.push(data.documentName || null);
    }
    if (data.consentGiven !== undefined) {
        fields.push('consent_given = ?');
        values.push(data.consentGiven ? 1 : 0);
    }
    if (data.status !== undefined && VALID_STATUSES.has(data.status)) {
        fields.push('status = ?');
        values.push(data.status);
    }

    if (fields.length === 0) return fetchApplicationById(id);

    values.push(id);
    await pool.query(`UPDATE mla_care_applications SET ${fields.join(', ')} WHERE id = ?`, values);

    return fetchApplicationById(id);
};

/**
 * Update only the status of a MLA Care application.
 */
export const updateApplicationStatusById = async (id, status) => {
    if (!VALID_STATUSES.has(status)) return null;
    await pool.query('UPDATE mla_care_applications SET status = ? WHERE id = ?', [status, id]);
    return fetchApplicationById(id);
};

/**
 * Delete a MLA Care application by id.
 */
export const deleteApplicationById = async (id) => {
    await pool.query('DELETE FROM mla_care_applications WHERE id = ?', [id]);
    return true;
};
