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
        case 'letter':     return category === 'Recommendation' ? 'Recommendation Letter' : (category || 'Official Letter');
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
    'Resolved', 'Approved', 'Implemented', 'Disbursed', 'Sent', 'Delivered', 'Archived'
]);

/**
 * Build dynamic timeline driven by real SMS follow-ups and office updates.
 */
/**
 * Build dynamic timeline driven by real SMS follow-ups and office updates.
 */
const buildTimeline = (createdAt, updates = [], status = '', refId = '', applicantName = '') => {
    const timeline = [];

    // Stage 1..N: Real updates & SMS follow-ups from DB (no fake initial step)
    updates.forEach((u) => {
        timeline.push({
            id: u.id,
            label: u.title || 'Office Follow-up Update',
            time: formatDate(u.created_at),
            note: u.sms_body || u.note || 'Follow-up update recorded by MLA Office staff.',
            status: 'completed',
            sms_sent: Boolean(u.sms_sent || u.sms_body),
            sms_body: u.sms_body || null,
            media: u.media || [],
            attachments: u.attachments || [],
        });
    });

    // Final Resolution Stage
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
            media: [],
            attachments: [],
        });
    }

    return timeline;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch updates for timeline derivation (including SMS fields, media, & attachments)
// ─────────────────────────────────────────────────────────────────────────────
const UPDATES_META = {
    complaint:  { table: 'complaint_updates',  fk: 'complaint_id',  mediaTable: 'complaint_media',       attTable: 'complaint_attachments' },
    issue:      { table: 'issue_updates',       fk: 'issue_id',      mediaTable: 'issue_media',           attTable: 'issue_attachments' },
    idea:       { table: 'idea_updates',         fk: 'idea_id',       mediaTable: 'idea_media',            attTable: 'idea_attachments' },
    suggestion: { table: 'suggestion_updates',  fk: 'suggestion_id', mediaTable: 'suggestion_media',      attTable: 'suggestion_attachments' },
    cm_fund:    { table: 'cm_fund_updates',     fk: 'request_id',    mediaTable: 'cm_fund_update_media' },
    letter:     { table: 'mla_letter_activity', fk: 'letter_id' },
};

const fetchUpdates = async (source, petitionId) => {
    if (source === 'letter') {
        try {
            const [activities] = await pool.query(
                `SELECT id, 'Activity' AS type, 'Office Letter Activity' AS title, action AS note, created_at
                 FROM mla_letter_activity
                 WHERE letter_id = ?
                 ORDER BY created_at ASC LIMIT 15`,
                [petitionId]
            );
            return (activities || []).map(a => ({ ...a, media: [], attachments: [] }));
        } catch {
            return [];
        }
    }

    const meta = UPDATES_META[source];
    if (!meta) return [];
    try {
        const [rows] = await pool.query(
            `SELECT * FROM \`${meta.table}\` 
             WHERE \`${meta.fk}\` = ? 
               AND (hide_from_public = 0 OR hide_from_public IS NULL) 
             ORDER BY created_at ASC LIMIT 25`,
            [petitionId]
        );

        // Fetch media and attachments associated with these updates
        const updateIds = rows.map(r => r.id).filter(Boolean);
        const mediaByUpdate = {};
        const attByUpdate = {};

        if (updateIds.length > 0 && meta.mediaTable) {
            try {
                if (source === 'cm_fund') {
                    const [cmMediaRows] = await pool.query(
                        `SELECT * FROM cm_fund_update_media WHERE update_id IN (?) ORDER BY created_at ASC`,
                        [updateIds]
                    );
                    cmMediaRows.forEach(m => {
                        if (m.media_type === 'document') {
                            if (!attByUpdate[m.update_id]) attByUpdate[m.update_id] = [];
                            attByUpdate[m.update_id].push({
                                id: m.id,
                                name: m.file_name || 'Document',
                                url: m.file_url,
                                type: 'document',
                            });
                        } else {
                            if (!mediaByUpdate[m.update_id]) mediaByUpdate[m.update_id] = [];
                            mediaByUpdate[m.update_id].push({
                                id: m.id,
                                url: m.file_url,
                                type: m.media_type || 'photo',
                                name: m.file_name || m.file_url.split('/').pop(),
                            });
                        }
                    });
                } else {
                    const [mediaRows] = await pool.query(
                        `SELECT * FROM \`${meta.mediaTable}\` WHERE update_id IN (?) ORDER BY created_at ASC`,
                        [updateIds]
                    );
                    mediaRows.forEach(m => {
                        if (!mediaByUpdate[m.update_id]) mediaByUpdate[m.update_id] = [];
                        mediaByUpdate[m.update_id].push({
                            id: m.id,
                            url: m.file_url,
                            type: m.media_type || 'photo',
                            name: m.caption || m.file_name || m.file_url.split('/').pop(),
                            size_kb: m.file_size_kb != null ? Number(m.file_size_kb) : null,
                        });
                    });

                    if (meta.attTable) {
                        const [attRows] = await pool.query(
                            `SELECT * FROM \`${meta.attTable}\` WHERE update_id IN (?) ORDER BY created_at ASC`,
                            [updateIds]
                        );
                        attRows.forEach(a => {
                            if (!attByUpdate[a.update_id]) attByUpdate[a.update_id] = [];
                            attByUpdate[a.update_id].push({
                                id: a.id,
                                name: a.file_name,
                                url: a.file_url,
                                type: a.file_type,
                                size_kb: a.file_size_kb != null ? Number(a.file_size_kb) : null,
                            });
                        });
                    }
                }
            } catch (err) {
                console.warn('[petitionsController] Error fetching update media/attachments:', err.message);
            }
        }

        const enrichedRows = rows.map(r => ({
            ...r,
            media: mediaByUpdate[r.id] || [],
            attachments: attByUpdate[r.id] || [],
        }));

        // Fetch communications logs (excluding those from hidden updates)
        let entityType = 'Complaint';
        if (source === 'issue') entityType = 'Issue';
        if (source === 'idea') entityType = 'Idea';
        if (source === 'suggestion') entityType = 'Suggestion';
        if (source === 'cm_fund') entityType = 'Application';

        const [commLogs] = await pool.query(
            `SELECT cl.id, 
                    'Communication' AS type, 
                    CONCAT(cl.channel, ' Sent') AS title, 
                    cl.channel,
                    cl.message AS note, 
                    cl.created_at, 
                    'communications_logs' as _source,
                    cl.admin_user_id,
                    au.full_name AS sent_by_name,
                    au.full_name AS author_name
             FROM communications_logs cl
             LEFT JOIN admin_users au ON cl.admin_user_id = au.id
             WHERE cl.entity_type = ? AND cl.entity_id COLLATE utf8mb4_unicode_ci = ?
               AND (cl.update_id IS NULL OR cl.update_id NOT IN (SELECT id FROM \`${meta.table}\` WHERE hide_from_public = 1))
             ORDER BY cl.created_at ASC`,
            [entityType, String(petitionId)]
        );

        const enrichedCommLogs = commLogs.map(c => ({
            ...c,
            media: [],
            attachments: [],
        }));

        const combined = [...enrichedRows, ...enrichedCommLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return combined.slice(0, 25);
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
        const phone10   = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;
        const phoneLike = phone10 ? `%${phone10}%` : null;

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

            UNION ALL

            SELECT
                'letter',
                l.id,
                l.letter_id,
                l.subject,
                l.type,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.remarks, '$.applicant_name')), l.recipient_name),
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.remarks, '$.applicant_phone')), ''),
                l.status,
                l.created_at,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(l.remarks, '$.local_body_id')) AS UNSIGNED)
            FROM mla_letters l
            WHERE l.trashed_at IS NULL
              AND (l.letter_id = ? OR CAST(l.id AS CHAR) = ?)
              AND (l.remarks LIKE ? OR l.reference LIKE ?)

            ORDER BY submitted_at DESC
            LIMIT 1
        `;

        const legParams = [ref, phoneLike];
        const letterParams = [ref, ref, phoneLike, phoneLike];
        const params    = [
            ...legParams,    // complaint
            ...legParams,    // issue
            ...legParams,    // idea
            ...legParams,    // suggestion
            ...legParams,    // cm_fund
            ...letterParams, // letter
        ];

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
