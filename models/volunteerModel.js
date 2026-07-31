import pool from '../configs/db.js';

const VALID_STATUSES      = new Set(['Active', 'On Call', 'Inactive']);
const VALID_AVAILABILITY  = new Set(['Emergency On-Call', 'Weekends Only', 'Weekdays', 'Weekends']);

/**
 * Safely serialize a value to a JSON string for DB storage.
 * Accepts array, JSON-string, or comma-separated string.
 */
const toJsonStr = (val) => {
    if (!val) return null;
    if (Array.isArray(val)) return JSON.stringify(val);
    try { JSON.parse(val); return val; } catch {
        // treat as comma-separated string
        return JSON.stringify(val.split(',').map((s) => s.trim()).filter(Boolean));
    }
};

/**
 * Safely parse a JSON column value from DB into an array.
 */
const fromJson = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
};

/**
 * Map a raw DB row to the camelCase volunteer response shape.
 */
const mapRow = (r) => ({
    id:              r.id,
    name:            r.name,
    phone:           r.phone,
    alternatePhone:  r.alternate_phone  || '',
    email:           r.email            || '',
    gender:          r.gender           || 'Male',
    bloodGroup:      r.blood_group      || '',
    localBodyId:     r.local_body_id    || null,
    panchayat:       r.panchayat        || '',
    wardId:          r.ward_id          || null,
    ward:            r.ward             || '',
    houseName:       r.house_name       || '',
    sector:          r.sector           || '',
    category:        fromJson(r.category),
    skills:          fromJson(r.skills),
    availability:    r.availability     || 'Weekends',
    status:          r.status           || 'Active',
    notes:           r.notes            || '',
    profilePhotoUrl: r.profile_photo_url || '',
    verified:        !!r.verified,
    joinedDate:      r.joined_date      || null,
    createdAt:       r.created_at       || null,
});

// ── Category count helper ────────────────────────────────────────────
const buildCategoryCounts = async () => {
    // Fetch all active-ish volunteers and count by first category
    const [rows] = await pool.query(
        `SELECT category FROM volunteers WHERE status != 'Inactive'`
    );
    const counts = { All: rows.length, 'Care Visits': 0, 'Camp Support': 0, 'Emergency Response': 0, 'Youth Activities': 0 };
    for (const r of rows) {
        const cats = fromJson(r.category);
        const primary = cats[0] || '';
        if (counts[primary] !== undefined) counts[primary]++;
    }
    return counts;
};

// ────────────────────────────────────────────────────────────────────
// READ — fetch list with optional filters + pagination
// ────────────────────────────────────────────────────────────────────
export const fetchAllVolunteers = async ({
    search = '',
    status = '',
    availability = '',
    sector = '',
    category = '',
    panchayat = '',
    local_body_id = '',
    ward_id = '',
    ward = '',
    page = 1,
    limit = 15,
} = {}) => {
    const params  = [];
    const wheres  = [];

    if (search) {
        wheres.push(`(name LIKE ? OR phone LIKE ? OR panchayat LIKE ? OR ward LIKE ?)`);
        const q = `%${search}%`;
        params.push(q, q, q, q);
    }
    if (status && VALID_STATUSES.has(status)) {
        wheres.push(`status = ?`);
        params.push(status);
    }
    if (availability && VALID_AVAILABILITY.has(availability)) {
        wheres.push(`availability = ?`);
        params.push(availability);
    }
    if (sector) {
        wheres.push(`sector = ?`);
        params.push(sector);
    }
    if (category) {
        // Match if the category JSON array contains the requested value
        wheres.push(`JSON_CONTAINS(category, JSON_QUOTE(?))`);
        params.push(category);
    }
    if (panchayat) {
        wheres.push(`panchayat = ?`);
        params.push(panchayat);
    }
    if (local_body_id) {
        wheres.push(`local_body_id = ?`);
        params.push(parseInt(local_body_id, 10));
    }
    if (ward_id) {
        wheres.push(`ward_id = ?`);
        params.push(parseInt(ward_id, 10));
    }
    if (ward) {
        // Text match on ward name — supports partial match
        wheres.push(`ward LIKE ?`);
        params.push(`%${ward}%`);
    }

    const where    = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const offset   = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const pageSize = parseInt(limit, 10);

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM volunteers ${where}`,
        params
    );

    const [rows] = await pool.query(
        `SELECT * FROM volunteers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
    );

    const counts = await buildCategoryCounts();

    return {
        data:  rows.map(mapRow),
        meta:  { total, page: parseInt(page, 10), limit: pageSize, counts },
    };
};

// ────────────────────────────────────────────────────────────────────
// READ ONE
// ────────────────────────────────────────────────────────────────────
export const fetchVolunteerById = async (id) => {
    const [[row]] = await pool.query(`SELECT * FROM volunteers WHERE id = ?`, [id]);
    return row ? mapRow(row) : null;
};

// ────────────────────────────────────────────────────────────────────
// CREATE
// ────────────────────────────────────────────────────────────────────
export const insertVolunteer = async (data) => {
    const {
        name, phone, alternatePhone, email, gender, bloodGroup,
        localBodyId, panchayat, wardId, ward, houseName,
        sector, category, skills, availability, status, notes,
        profilePhotoUrl, verified,
    } = data;

    const [result] = await pool.query(
        `INSERT INTO volunteers
            (name, phone, alternate_phone, email, gender, blood_group,
             local_body_id, panchayat, ward_id, ward, house_name,
             sector, category, skills, availability, status, notes,
             profile_photo_url, verified, joined_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
        [
            name,
            phone,
            alternatePhone  || null,
            email           || null,
            gender          || 'Male',
            bloodGroup      || null,
            localBodyId     ? parseInt(localBodyId, 10) : null,
            panchayat       || null,
            wardId          ? parseInt(wardId, 10) : null,
            ward            || null,
            houseName       || null,
            sector          || null,
            toJsonStr(category),
            toJsonStr(skills),
            availability    || 'Weekends',
            VALID_STATUSES.has(status) ? status : 'Active',
            notes           || null,
            profilePhotoUrl || null,
            verified        ? 1 : 0,
        ]
    );

    return fetchVolunteerById(result.insertId);
};

// ────────────────────────────────────────────────────────────────────
// UPDATE
// ────────────────────────────────────────────────────────────────────
export const updateVolunteerById = async (id, data) => {
    const fields = [];
    const values = [];

    const set = (col, val, transform = (v) => v) => {
        if (val !== undefined) { fields.push(`${col} = ?`); values.push(transform(val)); }
    };

    set('name',              data.name);
    set('phone',             data.phone);
    set('alternate_phone',   data.alternatePhone,  (v) => v || null);
    set('email',             data.email,           (v) => v || null);
    set('gender',            data.gender);
    set('blood_group',       data.bloodGroup,      (v) => v || null);
    set('local_body_id',     data.localBodyId,     (v) => v ? parseInt(v, 10) : null);
    set('panchayat',         data.panchayat,       (v) => v || null);
    set('ward_id',           data.wardId,          (v) => v ? parseInt(v, 10) : null);
    set('ward',              data.ward,            (v) => v || null);
    set('house_name',        data.houseName,       (v) => v || null);
    set('sector',            data.sector,          (v) => v || null);
    set('category',          data.category,        toJsonStr);
    set('skills',            data.skills,          toJsonStr);
    set('availability',      data.availability);
    set('status',            data.status,          (v) => VALID_STATUSES.has(v) ? v : undefined);
    set('notes',             data.notes,           (v) => v || null);
    set('profile_photo_url', data.profilePhotoUrl, (v) => v || null);
    set('verified',          data.verified,        (v) => v ? 1 : 0);

    if (fields.length === 0) return fetchVolunteerById(id);

    values.push(id);
    await pool.query(`UPDATE volunteers SET ${fields.join(', ')} WHERE id = ?`, values);
    return fetchVolunteerById(id);
};

// ────────────────────────────────────────────────────────────────────
// DELETE
// ────────────────────────────────────────────────────────────────────
export const deleteVolunteerById = async (id) => {
    await pool.query(`DELETE FROM volunteers WHERE id = ?`, [id]);
    return true;
};
