import pool from '../configs/db.js';

async function run() {
    const ref = 'C-001';
    const phoneLike = null;
    const legParams = [ref, ref, phoneLike, phoneLike];

    const sql = `
        SELECT 'complaint' AS source_table, c.id AS pk, c.reference_no AS ref_id,
               c.title AS petition_title, c.category AS petition_category,
               c.complainant_name AS applicant_name, c.phone AS applicant_phone,
               c.status AS current_status, c.created_at AS submitted_at, c.local_body_id
        FROM complaints c
        WHERE c.is_deleted = 0
          AND ((? != '' AND c.reference_no = ?) OR (? IS NOT NULL AND c.phone LIKE ?))
        UNION ALL
        SELECT 'issue', i.id, i.reference_no, i.title, i.category,
               i.submitter_name, i.phone, i.status, i.created_at, i.local_body_id
        FROM issues i
        WHERE i.is_deleted = 0
          AND ((? != '' AND i.reference_no = ?) OR (? IS NOT NULL AND i.phone LIKE ?))
        UNION ALL
        SELECT 'idea', id2.id, id2.reference_no, id2.title, id2.category,
               id2.complainant_name, id2.phone, id2.status, id2.created_at, id2.local_body_id
        FROM ideas id2
        WHERE id2.is_deleted = 0
          AND ((? != '' AND id2.reference_no = ?) OR (? IS NOT NULL AND id2.phone LIKE ?))
        UNION ALL
        SELECT 'suggestion', s.id, s.reference_no, s.title, s.category,
               s.complainant_name, s.phone, s.status, s.created_at, s.local_body_id
        FROM suggestions s
        WHERE s.is_deleted = 0
          AND ((? != '' AND s.reference_no = ?) OR (? IS NOT NULL AND s.phone LIKE ?))
        UNION ALL
        SELECT 'cm_fund', cf.id, cf.id,
               COALESCE(cf.application_title, 'CM Relief Aid'), COALESCE(cf.sub_category,'Aid'),
               cf.applicant_name, cf.applicant_phone, cf.status, cf.created_at, cf.local_body_id
        FROM cm_fund_requests cf
        WHERE (cf.is_deleted IS NULL OR cf.is_deleted = 0)
          AND ((? != '' AND cf.id = ?) OR (? IS NOT NULL AND cf.applicant_phone LIKE ?))
        ORDER BY submitted_at DESC
        LIMIT 1
    `;

    const params = [...legParams, ...legParams, ...legParams, ...legParams, ...legParams];
    try {
        const [rows] = await pool.query(sql, params);
        console.log('Result:', JSON.stringify(rows, null, 2));
    } catch(e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}
run();
