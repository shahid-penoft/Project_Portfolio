const VALID_CARE_CATEGORIES = new Set([
    'Emergency Financial Aid',
    'Life-Saving Medicine Support',
    '24/7 Free Emergency Ambulance',
    'Palliative & Home Care Services',
]);

// Legacy/aliased values that should be normalized to the canonical value.
const CATEGORY_ALIASES = {
    'Emergency Medical Financial Aid': 'Emergency Financial Aid',
};

const VALID_STATUSES = new Set(['Pending', 'Verified', 'Approved', 'Rejected']);

/**
 * Normalize a care category value (string) to the canonical enum, or null.
 */
export const normalizeCareCategory = (value) => {
    const raw = String(value || '').trim();
    if (VALID_CARE_CATEGORIES.has(raw)) return raw;
    if (CATEGORY_ALIASES[raw]) return CATEGORY_ALIASES[raw];
    return null;
};

/**
 * Middleware to validate POST /api/mla-care payload (public submit).
 * Attaches req.sanitizedApplication on success.
 */
export const validateMlaCarePayload = (req, res, next) => {
    const body = req.body || {};

    const patientName = String(body.patientName || '').trim();
    const phone = String(body.phone || '').trim();
    const category = normalizeCareCategory(body.careCategory);
    const localBodyId = body.localBodyId !== undefined && body.localBodyId !== '' ? parseInt(body.localBodyId, 10) : NaN;
    const wardId = body.wardId !== undefined && body.wardId !== '' ? parseInt(body.wardId, 10) : null;
    const houseName = String(body.houseName || '').trim();
    const medicalDetails = String(body.medicalDetails || '').trim();
    const documentUrl = String(body.documentUrl || '').trim();
    const documentName = String(body.documentName || '').trim();
    const consent = body.consent === true || body.consentChecked === true;

    const errors = [];

    if (!patientName || patientName.length < 2) {
        errors.push('Patient full name is required and must be at least 2 characters long.');
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 7 || digitsOnly.length > 15) {
        errors.push('Please enter a valid contact phone number.');
    }

    if (!category) {
        errors.push('Please select a valid MLA Care service category.');
    }

    if (!Number.isInteger(localBodyId) || localBodyId <= 0) {
        errors.push('Please select a valid Local Body.');
    }

    if (!consent) {
        errors.push('You must agree to the consent terms before submitting.');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: errors.join(' '),
            errors,
        });
    }

    req.sanitizedApplication = {
        patientName,
        phone,
        careCategory: category,
        localBodyId,
        wardId: Number.isInteger(wardId) && wardId > 0 ? wardId : null,
        houseName,
        medicalDetails,
        documentUrl,
        documentName,
        consentGiven: true,
    };

    next();
};

/**
 * Middleware to validate PUT /api/mla-care/:id payload (admin update).
 * Partial update — only provided fields are validated.
 */
export const validateMlaCareUpdatePayload = (req, res, next) => {
    const body = req.body || {};
    const out = {};
    const errors = [];

    if (body.patientName !== undefined) {
        const v = String(body.patientName || '').trim();
        if (v.length < 2) errors.push('Patient full name must be at least 2 characters long.');
        out.patientName = v;
    }
    if (body.phone !== undefined) {
        const v = String(body.phone || '').trim();
        const digitsOnly = v.replace(/\D/g, '');
        if (!digitsOnly || digitsOnly.length < 7 || digitsOnly.length > 15) {
            errors.push('Please enter a valid contact phone number.');
        }
        out.phone = v;
    }
    if (body.careCategory !== undefined) {
        const category = normalizeCareCategory(body.careCategory);
        if (!category) errors.push('Please select a valid MLA Care service category.');
        else out.careCategory = category;
    }
    if (body.localBodyId !== undefined) {
        const lb = body.localBodyId === '' ? NaN : parseInt(body.localBodyId, 10);
        if (!Number.isInteger(lb) || lb <= 0) errors.push('Please select a valid Local Body.');
        else out.localBodyId = lb;
    }
    if (body.wardId !== undefined) {
        const wd = body.wardId === '' ? null : parseInt(body.wardId, 10);
        out.wardId = Number.isInteger(wd) && wd > 0 ? wd : null;
    }
    if (body.houseName !== undefined) out.houseName = String(body.houseName || '').trim();
    if (body.medicalDetails !== undefined) out.medicalDetails = String(body.medicalDetails || '').trim();
    if (body.documentUrl !== undefined) out.documentUrl = String(body.documentUrl || '').trim();
    if (body.documentName !== undefined) out.documentName = String(body.documentName || '').trim();
    if (body.consentGiven !== undefined) out.consentGiven = !!body.consentGiven;
    if (body.status !== undefined) {
        if (!VALID_STATUSES.has(body.status)) errors.push('Invalid status value.');
        else out.status = body.status;
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: errors.join(' '),
            errors,
        });
    }

    req.sanitizedApplication = out;
    next();
};

/**
 * Middleware to validate PATCH /api/mla-care/:id/status payload.
 */
export const validateMlaCareStatusPayload = (req, res, next) => {
    const { status } = req.body || {};
    if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status. Must be one of: Pending, Verified, Approved, Rejected.',
        });
    }
    next();
};
