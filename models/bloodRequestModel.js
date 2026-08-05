import pool from '../configs/db.js';

/**
 * Fetch all blood requests with optional status/blood_group filters.
 */
export const fetchAllBloodRequests = async ({ status, bloodGroup } = {}) => {
    let sql = `
        SELECT
            br.id,
            br.patient_name   AS patientName,
            br.blood_group    AS bloodGroup,
            br.units_needed   AS unitsNeeded,
            br.hospital_name  AS hospitalName,
            br.department     AS department,
            br.hospital_location AS hospitalLocation,
            br.house_name     AS houseName,
            br.ward_info      AS wardInfo,
            br.local_body_id  AS localBodyId,
            lb.name           AS localBody,
            br.ward_id        AS wardId,
            br.contact_person AS contactPerson,
            br.contact_phone  AS contactPhone,
            br.required_date  AS requiredDate,
            br.status,
            br.notes,
            br.created_at     AS createdAt
        FROM blood_requests br
        LEFT JOIN local_bodies lb ON br.local_body_id = lb.id
        WHERE br.is_active = 1
    `;
    const params = [];

    if (status && status !== 'All') {
        sql += ` AND br.status = ?`;
        params.push(status);
    }

    const normGroup = (bloodGroup || '').trim().toUpperCase();
    if (normGroup && normGroup !== 'ALL') {
        sql += ` AND br.blood_group = ?`;
        params.push(normGroup);
    }

    sql += ` ORDER BY br.created_at DESC`;

    const [rows] = await pool.query(sql, params);

    return rows.map((r) => ({
        ...r,
        unitsNeeded: Number(r.unitsNeeded) || parseInt(r.unitsNeeded, 10) || r.unitsNeeded,
        requiredDate: r.requiredDate
            ? (r.requiredDate instanceof Date
                ? r.requiredDate.toISOString().split('T')[0]
                : String(r.requiredDate).split('T')[0])
            : null,
    }));
};

/**
 * Insert a new blood request.
 */
export const insertBloodRequest = async ({
    patientName,
    bloodGroup,
    unitsNeeded,
    hospitalName,
    department,
    hospitalLocation,
    houseName,
    localBodyId,
    wardId,
    contactPerson,
    contactPhone,
    requiredDate,
    notes,
    status,
}) => {
    const parsedLbId = localBodyId ? parseInt(localBodyId, 10) : null;
    const parsedWardId = wardId ? parseInt(wardId, 10) : null;
    const reqStatus = status || 'Pending';

    // Resolve localBody name and wardInfo from DB
    let wardInfo = null;
    try {
        if (parsedLbId && parsedWardId) {
            const [[ward]] = await pool.query(
                'SELECT ward_no, place_name FROM local_body_wards WHERE id = ?',
                [parsedWardId]
            );
            if (ward) {
                wardInfo = ward.ward_no
                    ? `Ward ${ward.ward_no}${ward.place_name ? ' - ' + ward.place_name : ''}`
                    : ward.place_name;
            }
        }
    } catch (err) {
        console.error('[insertBloodRequest] Ward resolve error:', err.message);
    }

    // Parse required_date — handle ISO string or Date object
    let parsedDate = requiredDate;
    if (requiredDate && typeof requiredDate === 'string') {
        parsedDate = requiredDate.split('T')[0]; // keep YYYY-MM-DD
    }

    const [result] = await pool.query(
        `INSERT INTO blood_requests
         (patient_name, blood_group, units_needed, hospital_name, department, hospital_location, house_name, local_body_id, ward_id, ward_info, contact_person, contact_phone, required_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            patientName,
            bloodGroup || 'O+',
            String(unitsNeeded || '2'),
            hospitalName,
            department || null,
            hospitalLocation || null,
            houseName || null,
            parsedLbId,
            parsedWardId,
            wardInfo,
            contactPerson || null,
            contactPhone,
            parsedDate,
            reqStatus,
            notes || null,
        ]
    );

    return {
        id: result.insertId,
        patientName,
        bloodGroup: bloodGroup || 'O+',
        unitsNeeded: unitsNeeded || '2',
        hospitalName,
        department: department || null,
        hospitalLocation: hospitalLocation || null,
        houseName: houseName || null,
        wardInfo,
        localBodyId: parsedLbId,
        wardId: parsedWardId,
        contactPerson: contactPerson || null,
        contactPhone,
        requiredDate: parsedDate,
        status: reqStatus,
        notes: notes || null,
    };
};

/**
 * Update an existing blood request (partial update).
 */
export const updateBloodRequestInDB = async (id, data) => {
    const fields = [];
    const values = [];

    if (data.patientName !== undefined) {
        fields.push('patient_name = ?');
        values.push(data.patientName);
    }
    if (data.bloodGroup !== undefined) {
        fields.push('blood_group = ?');
        values.push(data.bloodGroup);
    }
    if (data.unitsNeeded !== undefined) {
        fields.push('units_needed = ?');
        values.push(String(data.unitsNeeded));
    }
    if (data.hospitalName !== undefined) {
        fields.push('hospital_name = ?');
        values.push(data.hospitalName);
    }
    if (data.department !== undefined) {
        fields.push('department = ?');
        values.push(data.department || null);
    }
    if (data.hospitalLocation !== undefined) {
        fields.push('hospital_location = ?');
        values.push(data.hospitalLocation || null);
    }
    if (data.houseName !== undefined) {
        fields.push('house_name = ?');
        values.push(data.houseName || null);
    }
    if (data.contactPerson !== undefined) {
        fields.push('contact_person = ?');
        values.push(data.contactPerson || null);
    }
    if (data.contactPhone !== undefined) {
        fields.push('contact_phone = ?');
        values.push(data.contactPhone);
    }
    if (data.requiredDate !== undefined) {
        fields.push('required_date = ?');
        const d = data.requiredDate;
        values.push(typeof d === 'string' ? d.split('T')[0] : d);
    }
    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }
    if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(data.notes || null);
    }

    if (fields.length === 0) return true;

    values.push(id);
    const sql = `UPDATE blood_requests SET ${fields.join(', ')} WHERE id = ?`;
    await pool.query(sql, values);
    return true;
};

/**
 * Hard-delete a blood request.
 */
export const deleteBloodRequestInDB = async (id) => {
    await pool.query('DELETE FROM blood_requests WHERE id = ?', [id]);
    return true;
};
