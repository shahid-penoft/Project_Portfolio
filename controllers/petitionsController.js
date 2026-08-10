import pool from '../configs/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Strip everything except digits */
const digitsOnly = (str) => (str || '').replace(/\D/g, '');

/** Human-readable petition type label */
const labelType = (source, category) => {
    switch (source) {
        case 'complaint':  return category || 'Individual Complaint';
        case 'issue':      return category || 'Public Issue';
        case 'idea':       return category || 'Development Idea';
        case 'suggestion': return category || 'Constituency Suggestion';
        case 'cm_fund':    return category || 'CM Relief Aid';
        default:           return category || 'Petition';
    }
};

/** Format a date value as "D Mon, H:MM AM/PM" */
const formatDate = (d) => {
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Pending';
    const day   = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const hours = date.getHours();
    const mins  = String(date.getMinutes()).padStart(2, '0');
    const ampm  = hours >= 12 ? 'PM' : 'AM';
    const h12   = hours % 12 || 12;
    return `${day} ${month}, ${h12}:${mins} ${ampm}`;
};

/** Statuses that mark final resolution */
const RESOLVED_STATUSES = new Set([
    'Resolved', 'Approved', 'Implemented', 'Disbursed',
]);

/**
 * Build dynamic timeline driven by real SMS follow-ups and office updates.
 */
const buildTimeline = (createdAt, updates = [], status = '', refId = '', applicantName = '') => {
    const timeline = [];

    // Stage 1: Initial Submission & Confirmation SMS
    timeline.push({
        label: 'Petition Submitted & Confirmation SMS Sent',
        time: formatDate(createdAt),
        note: `Dear ${applicantName || 'Citizen'}, your petition (${refId}) has been registered in the MLA Connect Portal. Confirmation SMS dispatched.`,
        status: 'completed',
        sms_sent: true,
        sms_body: `Dear ${applicantName || 'Citizen'}, your petition (${refId}) has been registered in the MLA Connect Portal on ${formatDate(createdAt)}. Status: Pending.`,
    });

    // Stage 2..N: Real updates & SMS follow-ups from DB
    updates.forEach((u) => {
        timeline.push({
            label: u.title || 'Office Follow-up Update',
            time: formatDate(u.created_at),
            note: u.sms_body || u.note || 'Follow-up update recorded by MLA Office staff.',
            status: 'completed',
            sms_sent: Boolean(u.sms_sent || u.sms_body),
            sms_body: u.sms_body || null,
        });
    });

    // Final / Current Stage
    const isResolved = RESOLVED_STATUSES.has(status);

    if (isResolved) {
        const lastUpdateTime = updates.length > 0 ? formatDate(updates[updates.length - 1].created_at) : formatDate(createdAt);
        timeline.push({
            label: `Final Resolution: ${status}`,
            time: lastUpdateTime,
            note: `Official resolution & response completed by Office of MLA Shibu Theckumpuram.`,
            status: 'completed',
            sms_sent: true,
            sms_body: `Petition ${refId} status updated to ${status}. Thank you for reaching out to MLA Connect.`,
        });
    } else {
        const currentStatusLabel = status && status.trim() ? status : 'Under Process';
        timeline.push({
            label: `Current Status: ${currentStatusLabel}`,
            time: 'In Progress',
            note: `Assigned to MLA Office Public Cell for further verification and action.`,
            status: 'current',
            sms_sent: false,
            sms_body: null,
        });
    }

    return timeline;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch updates for timeline derivation (including SMS fields)
// ─────────────────────────────────────────────────────────────────────────────
const UPDATES_META = {
    complaint:  { table: 'complaint_updates',  fk: 'complaint_id'  },
    issue:      { table: 'issue_updates',       fk: 'issue_id'      },
    idea:       { table: 'idea_updates',         fk: 'idea_id'       },
    suggestion: { table: 'suggestion_updates',  fk: 'suggestion_id' },
    cm_fund:    { table: 'cm_fund_request_updates', fk: 'request_id' },
};

const fetchUpdates = async (source, petitionId) => {
    const meta = UPDATES_META[source];
    if (!meta) return [];
    try {
        const [rows] = await pool.query(
            `SELECT * FROM \`${meta.table}\` WHERE \`${meta.fk}\` = ? ORDER BY created_at ASC LIMIT 15`,
            [petitionId]
        );

        // Fetch communications logs
        let entityType = 'Complaint';
        if (source === 'issue') entityType = 'Issue';
        if (source === 'idea') entityType = 'Idea';
        if (source === 'suggestion') entityType = 'Suggestion';
        if (source === 'cm_fund') entityType = 'Application';

        const [commLogs] = await pool.query(
            `SELECT id, 'Communication' AS type, CONCAT(channel, ' Sent') AS title, message AS note, created_at, 'communications_logs' as _source 
             FROM communications_logs 
             WHERE entity_type = ? AND entity_id = ?`,
            [entityType, petitionId]
        );

        const combined = [...rows, ...commLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return combined.slice(0, 15);
    } catch {
        return [];
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/petitions/track?ref=C-001  OR  ?phone=9847100000
// Public — no auth required
// ─────────────────────────────────────────────────────────────────────────────
export const trackPetition = async (req, res) => {
    try {
        const ref       = (req.query.ref   || '').trim().toUpperCase();
        const rawPhone  = digitsOnly(req.query.phone || '');
        const phoneLike = rawPhone ? `%${rawPhone}%` : null;

        if (!ref || !rawPhone) {
            return res.status(400).json({
                success: false,
                message: 'Both Tracking Reference ID and Registered Mobile Phone Number are required.',
            });
        }

        const sql = `
            SELECT
                'complaint'         AS source_table,
                c.id                AS pk,
                c.reference_no      AS ref_id,
                c.title             AS petition_title,
                c.category          AS petition_category,
                c.complainant_name  AS applicant_name,
                c.phone             AS applicant_phone,
                c.status            AS current_status,
                c.created_at        AS submitted_at,
                c.local_body_id
            FROM complaints c
            WHERE c.is_deleted = 0
              AND c.reference_no = ?
              AND c.phone LIKE ?

            UNION ALL

            SELECT
                'issue',
                i.id,
                i.reference_no,
                i.title,
                i.category,
                i.submitter_name,
                i.phone,
                i.status,
                i.created_at,
                i.local_body_id
            FROM issues i
            WHERE i.is_deleted = 0
              AND i.reference_no = ?
              AND i.phone LIKE ?

            UNION ALL

            SELECT
                'idea',
                id2.id,
                id2.reference_no,
                id2.title,
                id2.category,
                id2.complainant_name,
                id2.phone,
                id2.status,
                id2.created_at,
                id2.local_body_id
            FROM ideas id2
            WHERE id2.is_deleted = 0
              AND id2.reference_no = ?
              AND id2.phone LIKE ?

            UNION ALL

            SELECT
                'suggestion',
                s.id,
                s.reference_no,
                s.title,
                s.category,
                s.complainant_name,
                s.phone,
                s.status,
                s.created_at,
                s.local_body_id
            FROM suggestions s
            WHERE s.is_deleted = 0
              AND s.reference_no = ?
              AND s.phone LIKE ?

            UNION ALL

            SELECT
                'cm_fund',
                cf.id,
                cf.id,
                COALESCE(cf.application_title, 'CM Relief Aid'),
                COALESCE(cf.sub_category, 'Aid'),
                cf.applicant_name,
                cf.applicant_phone,
                cf.status,
                cf.created_at,
                cf.local_body_id
            FROM cm_fund_requests cf
            WHERE (cf.is_deleted IS NULL OR cf.is_deleted = 0)
              AND cf.id = ?
              AND cf.applicant_phone LIKE ?

            ORDER BY submitted_at DESC
            LIMIT 1
        `;

        const legParams = [ref, phoneLike];
        const params    = [...legParams, ...legParams, ...legParams, ...legParams, ...legParams];

        const [rows] = await pool.query(sql, params);

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No petition found matching the provided Tracking Reference ID and mobile phone number.',
            });
        }

        const row = rows[0];

        // ── Resolve local body name ──────────────────────────────────────────
        let localBodyName = 'Kothamangalam Constituency';
        if (row.local_body_id) {
            try {
                const [[lb]] = await pool.query(
                    'SELECT name, type FROM local_bodies WHERE id = ?',
                    [row.local_body_id]
                );
                if (lb) localBodyName = `${lb.name} ${lb.type || ''}`.trim();
            } catch { /* non-fatal */ }
        }

        // ── Fetch timeline updates ───────────────────────────────────────────
        const updates  = await fetchUpdates(row.source_table, row.pk);
        const timeline = buildTimeline(row.submitted_at, updates, row.current_status, row.ref_id, row.applicant_name);

        // ── Submitted date display ───────────────────────────────────────────
        const submittedDisplay = new Date(row.submitted_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        });

        // Mask phone for privacy in response (e.g. +91 ******1920)
        const maskedPhone = row.applicant_phone
            ? row.applicant_phone.replace(/^(\+?\d{2})?\d{6}(\d{4})$/, '$1******$2')
            : null;

        return res.json({
            success: true,
            data: {
                id:              row.ref_id,
                type:            labelType(row.source_table, row.petition_category),
                applicant_name:  row.applicant_name,
                applicant_phone: maskedPhone,
                local_body:      localBodyName,
                submitted_date:  submittedDisplay,
                status:          row.current_status,
                timeline,
            },
        });

    } catch (err) {
        console.error('[trackPetition]', err);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again.',
        });
    }
};
