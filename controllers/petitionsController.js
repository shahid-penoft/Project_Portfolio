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

/** Statuses that mark stage-5 as complete */
const RESOLVED_STATUSES = new Set([
    'Resolved', 'Approved', 'Implemented', 'Disbursed',
]);

const STAGE_LABELS = [
    'Submitted',
    'Received by Office',
    'Under Review',
    'Field Inspection Scheduled',
    'Resolution & Response',
];

const STAGE_NOTES = [
    'Registered in MLA Connect Portal',
    'Cataloged & verified by MLA Public Cell',
    'Assigned to relevant department officer',
    'On-site verification scheduled',
    'Final resolution & response issued',
];

/**
 * Build the canonical 5-stage timeline from DB data.
 * Stage 1 is always "completed" (petition exists = it was submitted).
 */
const buildTimeline = (createdAt, updates, status) => {
    const completedFlags = [
        true,
        updates.length >= 1,
        updates.length >= 2 || /under|review|process/i.test(status || ''),
        updates.length >= 3,
        RESOLVED_STATUSES.has(status),
    ];

    const times = [
        formatDate(createdAt),
        updates[0] ? formatDate(updates[0].created_at) : 'Pending',
        updates[1] ? formatDate(updates[1].created_at) : 'Pending',
        updates[2] ? formatDate(updates[2].created_at) : 'Pending',
        updates[3] ? formatDate(updates[3].created_at) : 'Pending',
    ];

    // First non-completed index = "current"
    const currentIdx = completedFlags.findIndex((f) => !f);

    return STAGE_LABELS.map((label, i) => {
        let stageStatus;
        if (completedFlags[i])      stageStatus = 'completed';
        else if (i === currentIdx)  stageStatus = 'current';
        else                        stageStatus = 'pending';

        const updateNote = updates[i - 1]?.note || updates[i - 1]?.title || null;
        const note = (i > 0 && updateNote) ? updateNote : STAGE_NOTES[i];

        return {
            label,
            time:   stageStatus === 'pending' ? 'Pending' : times[i],
            note,
            status: stageStatus,
        };
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch updates for timeline derivation
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
            `SELECT * FROM \`${meta.table}\` WHERE \`${meta.fk}\` = ? ORDER BY created_at ASC LIMIT 10`,
            [petitionId]
        );
        return rows;
    } catch {
        return []; // table might not exist (cm_fund edge case)
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

        if (!ref && !rawPhone) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a Tracking Reference ID or a registered mobile number.',
            });
        }

        // ── UNION query ──────────────────────────────────────────────────────
        // Each leg produces exactly the same 10-column shape so UNION ALL works.
        // Column names in the first leg define the result aliases.
        //
        // Per-table differences:
        //   complaints  → complainant_name, phone
        //   issues      → submitter_name,   phone
        //   ideas       → complainant_name, phone
        //   suggestions → complainant_name, phone
        //   cm_fund     → applicant_name,   applicant_phone  (no is_deleted)
        //
        // The phone IS NOT NULL guard ensures we don't LIKE-match on NULL.
        // ──────────────────────────────────────────────────────────────────────
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
              AND (
                    (? != '' AND c.reference_no = ?)
                 OR (? IS NOT NULL AND c.phone LIKE ?)
              )

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
              AND (
                    (? != '' AND i.reference_no = ?)
                 OR (? IS NOT NULL AND i.phone LIKE ?)
              )

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
              AND (
                    (? != '' AND id2.reference_no = ?)
                 OR (? IS NOT NULL AND id2.phone LIKE ?)
              )

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
              AND (
                    (? != '' AND s.reference_no = ?)
                 OR (? IS NOT NULL AND s.phone LIKE ?)
              )

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
              AND (
                    (? != '' AND cf.id = ?)
                 OR (? IS NOT NULL AND cf.applicant_phone LIKE ?)
              )

            ORDER BY submitted_at DESC
            LIMIT 1
        `;

        // 4 params per leg × 5 legs = 20 params
        const legParams = [ref, ref, phoneLike, phoneLike];
        const params    = [...legParams, ...legParams, ...legParams, ...legParams, ...legParams];

        const [rows] = await pool.query(sql, params);

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No petition found with the provided ID or phone number.',
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
                if (lb) localBodyName = `${lb.name} ${lb.type}`.trim();
            } catch { /* non-fatal */ }
        }

        // ── Fetch timeline updates ───────────────────────────────────────────
        const updates  = await fetchUpdates(row.source_table, row.pk);
        const timeline = buildTimeline(row.submitted_at, updates, row.current_status);

        // ── Submitted date display ───────────────────────────────────────────
        const submittedDisplay = new Date(row.submitted_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        });

        return res.json({
            success: true,
            data: {
                id:             row.ref_id,
                type:           labelType(row.source_table, row.petition_category),
                applicant_name: row.applicant_name,
                local_body:     localBodyName,
                submitted_date: submittedDisplay,
                status:         row.current_status,
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
