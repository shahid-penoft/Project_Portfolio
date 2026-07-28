import pool from '../configs/db.js';

/**
 * Fetch latest active urgent blood need request.
 */
export const fetchActiveUrgentNeeds = async () => {
    const [rows] = await pool.query(`
        SELECT
            id,
            title,
            blood_group AS bloodGroup,
            units_needed AS unitsNeeded,
            hospital_name AS hospitalName,
            ward_details AS wardDetails,
            contact_phone AS contactPhone,
            status,
            created_at AS createdAt
        FROM urgent_blood_needs
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
    `);
    return rows[0] || null;
};

/**
 * Fetch blood donors with optional blood group filter.
 */
export const fetchDonorsByGroup = async (bloodGroup) => {
    let sql = `
        SELECT
            d.id,
            d.name,
            d.blood_group AS bloodGroup,
            d.phone,
            d.alternate_phone AS alternatePhone,
            d.email,
            d.panchayat,
            d.local_body_id AS localBodyId,
            lb.name AS localBodyName,
            d.ward_id AS wardId,
            w.ward_no AS wardNumber,
            w.place_name AS wardPlaceName,
            d.last_donated AS lastDonated,
            d.is_verified AS verified,
            d.status,
            d.notes,
            d.profile_photo_url AS profilePhotoUrl,
            d.created_at AS createdAt
        FROM blood_donors d
        LEFT JOIN local_bodies lb ON d.local_body_id = lb.id
        LEFT JOIN local_body_wards w ON d.ward_id = w.id
        WHERE d.is_active = 1
    `;
    const params = [];

    const normGroup = (bloodGroup || '').trim().toUpperCase();
    if (normGroup && normGroup !== 'ALL') {
        sql += ` AND d.blood_group = ?`;
        params.push(normGroup);
    }

    sql += ` ORDER BY d.created_at DESC`;

    const [rows] = await pool.query(sql, params);
    return rows.map((r) => {
        let wardStr = '';
        if (r.wardNumber) {
            wardStr = `Ward ${r.wardNumber}${r.wardPlaceName ? ' - ' + r.wardPlaceName : ''}`;
        }
        return {
            ...r,
            ward: wardStr || r.wardPlaceName || '',
            localBodyName: r.localBodyName || r.panchayat || '',
        };
    });
};

/**
 * Insert a new voluntary blood donor into DB.
 */
export const insertBloodDonor = async ({
    name,
    bloodGroup,
    phone,
    alternatePhone,
    email,
    localBodyId,
    wardId,
    panchayat,
    status,
    verified,
    notes,
    profilePhotoUrl
}) => {
    let resolvedPanchayat = panchayat || 'Kothamangalam Constituency';

    const parsedLbId   = localBodyId ? parseInt(localBodyId, 10) : null;
    const parsedWardId = wardId ? parseInt(wardId, 10) : null;
    const isVerified   = verified !== undefined ? (verified ? 1 : 0) : 1;
    const donorStatus  = status || 'Accepted';

    if (parsedLbId) {
        try {
            const [[lb]] = await pool.query('SELECT name FROM local_bodies WHERE id = ?', [parsedLbId]);
            const lbName = lb ? lb.name : '';

            let wardName = '';
            if (parsedWardId) {
                const [[ward]] = await pool.query('SELECT ward_no, place_name FROM local_body_wards WHERE id = ?', [parsedWardId]);
                if (ward) {
                    wardName = `Ward ${ward.ward_no}${ward.place_name ? ' - ' + ward.place_name : ''}`;
                }
            }

            if (lbName) {
                resolvedPanchayat = wardName ? `${lbName} - ${wardName}` : lbName;
            }
        } catch (err) {
            console.error('Error resolving local body / ward name:', err);
        }
    }

    const [result] = await pool.query(
        `INSERT INTO blood_donors (name, blood_group, phone, alternate_phone, email, panchayat, local_body_id, ward_id, last_donated, is_verified, is_active, status, notes, profile_photo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Recently Registered', ?, 1, ?, ?, ?)`,
        [
            name,
            bloodGroup || 'O+',
            phone,
            alternatePhone || null,
            email || null,
            resolvedPanchayat,
            parsedLbId,
            parsedWardId,
            isVerified,
            donorStatus,
            notes || null,
            profilePhotoUrl || null
        ]
    );

    return {
        id: result.insertId,
        name,
        bloodGroup: bloodGroup || 'O+',
        phone,
        alternatePhone: alternatePhone || '',
        email: email || '',
        panchayat: resolvedPanchayat,
        localBodyId: parsedLbId,
        wardId: parsedWardId,
        lastDonated: 'Recently Registered',
        verified: !!isVerified,
        status: donorStatus,
        notes: notes || '',
        profilePhotoUrl: profilePhotoUrl || ''
    };
};

/**
 * Update an existing blood donor record in DB.
 */
export const updateBloodDonorInDB = async (id, data) => {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
        fields.push('name = ?');
        values.push(data.name);
    }
    if (data.bloodGroup !== undefined) {
        fields.push('blood_group = ?');
        values.push(data.bloodGroup);
    }
    if (data.phone !== undefined) {
        fields.push('phone = ?');
        values.push(data.phone);
    }
    if (data.alternatePhone !== undefined) {
        fields.push('alternate_phone = ?');
        values.push(data.alternatePhone);
    }
    if (data.email !== undefined) {
        fields.push('email = ?');
        values.push(data.email);
    }
    if (data.panchayat !== undefined) {
        fields.push('panchayat = ?');
        values.push(data.panchayat);
    }
    if (data.localBodyId !== undefined) {
        fields.push('local_body_id = ?');
        values.push(data.localBodyId ? parseInt(data.localBodyId, 10) : null);
    }
    if (data.wardId !== undefined) {
        fields.push('ward_id = ?');
        values.push(data.wardId ? parseInt(data.wardId, 10) : null);
    }
    if (data.verified !== undefined) {
        fields.push('is_verified = ?');
        values.push(data.verified ? 1 : 0);
    }
    if (data.status !== undefined) {
        fields.push('status = ?');
        values.push(data.status);
    }
    if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(data.notes);
    }

    if (fields.length === 0) return true;

    values.push(id);
    const sql = `UPDATE blood_donors SET ${fields.join(', ')} WHERE id = ?`;
    await pool.query(sql, values);
    return true;
};

/**
 * Delete a blood donor record from DB.
 */
export const deleteBloodDonorInDB = async (id) => {
    await pool.query('DELETE FROM blood_donors WHERE id = ?', [id]);
    return true;
};
