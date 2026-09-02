import db from './configs/db.js';

const columns = [
    { name: 'raw_id', c: 'c.id', i: 'i.id', f: 'f.id', l: 'l.id', g: 'g.id' },
    { name: 'display_id', c: "IFNULL(c.reference_no, CONCAT('C-', c.id))", i: "IFNULL(i.reference_no, CONCAT('P-', i.id))", f: "CAST(f.id AS CHAR)", l: "IFNULL(l.letter_id COLLATE utf8mb4_unicode_ci, CONCAT('L-', l.id))", g: "IF(g.governing_body_type COLLATE utf8mb4_unicode_ci ='OTHER', CONCAT('O-', g.id), CONCAT('M-', g.id))" },
    { name: 'module', c: "'Complaints'", i: "'Public Issue'", f: "'Applications'", l: "'Letters'", g: "IF(g.governing_body_type COLLATE utf8mb4_unicode_ci ='OTHER', 'Office', 'Governing Body')" },
    { name: 'title', c: 'c.title', i: 'i.title', f: "IFNULL(f.applicant_name, 'Untitled Application')", l: 'l.subject', g: 'g.name' },
    { name: 'local_body_name', c: 'lb.name', i: 'lb.name', f: 'lb.name', l: 'NULL', g: 'lb.name' },
    { name: 'ward_name', c: 'w.place_name', i: 'w.place_name', f: 'w.place_name', l: 'NULL', g: 'w.place_name' },
    { name: 'priority', c: 'c.priority', i: 'i.priority', f: 'f.priority', l: 'l.priority', g: "'Normal'" },
    { name: 'status', c: 'c.status', i: 'i.status', f: 'f.status', l: 'l.status', g: 'g.status' },
    { name: 'created_at', c: 'c.created_at', i: 'i.created_at', f: 'f.created_at', l: 'l.created_at', g: 'g.created_at' },
    { name: 'updated_at', c: 'c.updated_at', i: 'i.updated_at', f: 'f.updated_at', l: 'l.updated_at', g: 'g.updated_at' },
    { name: 'deleted_at', c: 'c.deleted_at', i: 'i.deleted_at', f: 'f.deleted_at', l: 'l.trashed_at', g: 'g.deleted_at' },
    { name: 'created_by', c: 'u.full_name', i: 'u.full_name', f: 'u.full_name', l: 'u.full_name', g: 'NULL' },
    { name: 'deleted_by', c: 'del_u.full_name', i: 'del_u.full_name', f: 'del_u.full_name', l: 'del_u.full_name', g: 'NULL' }
];

async function test() {
    let selectC = [], selectI = [], selectF = [], selectL = [], selectG = [];
    
    for (const col of columns) {
        selectC.push(`${col.c} AS ${col.name}`);
        selectI.push(`${col.i} AS ${col.name}`);
        selectF.push(`${col.f} AS ${col.name}`);
        selectL.push(`${col.l} AS ${col.name}`);
        selectG.push(`${col.g} AS ${col.name}`);
        
        try {
            const query = `
                SELECT ${selectC.join(', ')} FROM complaints c
                LEFT JOIN local_bodies lb ON c.local_body_id = lb.id
                LEFT JOIN local_body_wards w ON c.ward_id = w.id
                LEFT JOIN admin_users u ON c.filed_by_admin_id = u.id
                LEFT JOIN admin_users del_u ON c.updated_by_admin_id = del_u.id 
                UNION ALL
                SELECT ${selectI.join(', ')} FROM issues i
                LEFT JOIN local_bodies lb ON i.local_body_id = lb.id
                LEFT JOIN local_body_wards w ON i.ward_id = w.id
                LEFT JOIN admin_users u ON i.filed_by_admin_id = u.id
                LEFT JOIN admin_users del_u ON i.updated_by_admin_id = del_u.id
                UNION ALL
                SELECT ${selectF.join(', ')} FROM cm_fund_requests f
                LEFT JOIN local_bodies lb ON f.local_body_id = lb.id
                LEFT JOIN local_body_wards w ON f.ward_id = w.id
                LEFT JOIN admin_users u ON f.submitted_by_id = u.id
                LEFT JOIN admin_users del_u ON f.deleted_by_id = del_u.id
                UNION ALL
                SELECT ${selectL.join(', ')} FROM mla_letters l
                LEFT JOIN admin_users u ON l.prepared_by_user_id = u.id
                LEFT JOIN admin_users del_u ON l.trashed_by_id = del_u.id
                UNION ALL
                SELECT ${selectG.join(', ')} FROM governing_representatives g
                LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
                LEFT JOIN local_body_wards w ON g.ward_id = w.id
            `;
            await db.query(query);
            console.log(`Success up to ${col.name}`);
        } catch(e) {
            console.error(`Failed at ${col.name}:`, e.message);
            break;
        }
    }
    process.exit(0);
}
test();
