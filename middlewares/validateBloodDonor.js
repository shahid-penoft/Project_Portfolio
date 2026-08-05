const VALID_BLOOD_GROUPS = new Set(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']);

/**
 * Middleware to validate POST /api/blood-donors registration payload.
 */
export const validateBloodDonorPayload = (req, res, next) => {
    const { name, bloodGroup, phone, panchayat, localBodyId, wardId } = req.body || {};

    const cleanName = (name || '').trim();
    const cleanGroup = (bloodGroup || '').trim().toUpperCase();
    const cleanPhone = (phone || '').trim();
    const cleanPanchayat = (panchayat || '').trim();

    const errors = [];

    if (!cleanName || cleanName.length < 2) {
        errors.push('Full Name is required and must be at least 2 characters long.');
    }

    if (!cleanGroup || !VALID_BLOOD_GROUPS.has(cleanGroup)) {
        errors.push('Please select a valid Blood Group (O+, O-, A+, A-, B+, B-, AB+, AB-).');
    }

    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 7 || digitsOnly.length > 15) {
        errors.push('Please enter a valid contact phone number.');
    }

    if (!cleanPanchayat && !localBodyId) {
        errors.push('Please select a Panchayat / Local Body.');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: errors.join(' '),
            errors,
        });
    }

    // Attach sanitized values
    req.sanitizedDonor = {
        name: cleanName,
        bloodGroup: cleanGroup,
        phone: cleanPhone,
        panchayat: cleanPanchayat,
        localBodyId: localBodyId || null,
        wardId: wardId || null,
        gender: req.body.gender || 'Male',
        age: req.body.age || null,
        alternatePhone: req.body.alternatePhone || null,
        email: req.body.email || null,
        houseName: req.body.houseName || null,
        status: req.body.status || 'Accepted',
        verified: req.body.verified !== undefined ? req.body.verified : true,
        displayInDirectory: req.body.displayInDirectory !== undefined ? req.body.displayInDirectory : true,
        notes: req.body.notes || null,
        profilePhotoUrl: req.body.profilePhotoUrl || null,
    };

    next();
};
