const VALID_STATUSES     = new Set(['Active', 'On Call', 'Inactive']);
const VALID_AVAILABILITY = new Set(['Emergency On-Call', 'Weekends Only', 'Weekdays', 'Weekends']);
const EMAIL_RE           = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Safely parse category/skills which may arrive as:
 *  - JSON array string: ["Care Visits","Camp Support"]
 *  - comma string:      Care Visits,Camp Support
 *  - already an array   (req.body with JSON content-type)
 */
const parseArrayField = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
        const p = JSON.parse(val);
        return Array.isArray(p) ? p : [String(p)];
    } catch {
        return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
};

/**
 * Middleware: validate + sanitize POST /api/volunteers payload.
 * Attaches req.sanitizedVolunteer on success.
 */
export const validateVolunteerPayload = (req, res, next) => {
    const body   = req.body || {};
    const errors = [];

    const name  = (body.name  || '').trim();
    const phone = (body.phone || '').trim();

    if (!name || name.length < 2)   errors.push('Full Name is required (min 2 characters).');
    if (name.length > 100)          errors.push('Full Name must not exceed 100 characters.');
    if (!phone)                     errors.push('Primary Phone Number is required.');

    if (body.email) {
        const email = body.email.trim();
        if (!EMAIL_RE.test(email)) errors.push('Please enter a valid email address.');
        if (email.length > 254)    errors.push('Email address must not exceed 254 characters.');
    }
    if (body.status && !VALID_STATUSES.has(body.status)) {
        errors.push('Status must be one of: Active, On Call, Inactive.');
    }
    if (body.availability && !VALID_AVAILABILITY.has(body.availability)) {
        errors.push('Availability must be one of: Emergency On-Call, Weekends Only, Weekdays.');
    }
    if (body.notes && body.notes.length > 500) {
        errors.push('Notes must not exceed 500 characters.');
    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join(' '), errors });
    }

    req.sanitizedVolunteer = {
        name,
        phone,
        alternatePhone:  (body.alternatePhone || '').trim()  || null,
        email:           (body.email          || '').trim()  || null,
        gender:          body.gender          || 'Male',
        bloodGroup:      body.bloodGroup      || null,
        localBodyId:     body.localBodyId     || null,
        panchayat:       (body.panchayat      || '').trim()  || null,
        wardId:          body.wardId          || null,
        ward:            (body.ward           || '').trim()  || null,
        houseName:       (body.houseName      || '').trim()  || null,
        sector:          (body.sector         || '').trim()  || null,
        category:        parseArrayField(body.category),
        skills:          parseArrayField(body.skills),
        availability:    body.availability    || 'Weekends',
        status:          VALID_STATUSES.has(body.status) ? body.status : 'Active',
        notes:           (body.notes          || '').trim()  || null,
        profilePhotoUrl: body.profilePhotoUrl || null,
        verified:        !!body.verified,
    };

    next();
};

/**
 * Middleware: validate + sanitize PUT /api/volunteers/:id (all fields optional).
 * Attaches req.sanitizedVolunteer on success.
 */
export const validateVolunteerUpdatePayload = (req, res, next) => {
    const body   = req.body || {};
    const errors = [];

    if (body.name !== undefined) {
        const n = (body.name || '').trim();
        if (n.length < 2)   errors.push('Full Name must be at least 2 characters.');
        if (n.length > 100) errors.push('Full Name must not exceed 100 characters.');
    }
    if (body.email !== undefined && body.email) {
        const e = body.email.trim();
        if (!EMAIL_RE.test(e)) errors.push('Please enter a valid email address.');
        if (e.length > 254)    errors.push('Email address must not exceed 254 characters.');
    }
    if (body.status && !VALID_STATUSES.has(body.status)) {
        errors.push('Status must be one of: Active, On Call, Inactive.');
    }
    if (body.availability && !VALID_AVAILABILITY.has(body.availability)) {
        errors.push('Availability must be one of: Emergency On-Call, Weekends Only, Weekdays.');
    }
    if (body.notes && body.notes.length > 500) {
        errors.push('Notes must not exceed 500 characters.');
    }

    if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join(' '), errors });
    }

    const update = {};
    const optStr = (key, src) => { if (src !== undefined) update[key] = (src || '').trim() || null; };
    const optRaw = (key, src) => { if (src !== undefined) update[key] = src; };

    if (body.name  !== undefined) update.name  = body.name.trim();
    if (body.phone !== undefined) update.phone = body.phone.trim();
    optStr('alternatePhone',  body.alternatePhone);
    optStr('email',           body.email);
    optRaw('gender',          body.gender);
    optStr('bloodGroup',      body.bloodGroup);
    optRaw('localBodyId',     body.localBodyId);
    optStr('panchayat',       body.panchayat);
    optRaw('wardId',          body.wardId);
    optStr('ward',            body.ward);
    optStr('houseName',       body.houseName);
    optStr('sector',          body.sector);
    if (body.category  !== undefined) update.category  = parseArrayField(body.category);
    if (body.skills    !== undefined) update.skills    = parseArrayField(body.skills);
    optRaw('availability',    body.availability);
    optRaw('status',          body.status);
    optStr('notes',           body.notes);
    optStr('profilePhotoUrl', body.profilePhotoUrl);
    if (body.verified !== undefined) update.verified = !!body.verified;

    req.sanitizedVolunteer = update;
    next();
};
