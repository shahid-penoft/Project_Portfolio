import 'dotenv/config';
import db from '../configs/db.js';

async function verify() {
  const [counts] = await db.query(`
    SELECT lb.name as local_body, COUNT(gr.id) as count
    FROM local_bodies lb
    JOIN governing_representatives gr ON gr.local_body_id = lb.id
    WHERE gr.is_deleted = 0
    GROUP BY lb.id
    ORDER BY lb.name
  `);
  console.log('--- Seeded Members per Local Body ---');
  console.table(counts);

  const [sample] = await db.query(`
    SELECT gr.id, gr.name, gr.phone, gr.party, r.label as role, gr.additional_roles, lb.name as local_body, w.ward_no, w.place_name
    FROM governing_representatives gr
    LEFT JOIN local_bodies lb ON gr.local_body_id = lb.id
    LEFT JOIN local_body_wards w ON gr.ward_id = w.id
    LEFT JOIN mla_dropdown_lists r ON gr.role_id = r.id
    WHERE gr.is_deleted = 0
    ORDER BY gr.id ASC
    LIMIT 10
  `);
  console.log('--- Sample 10 Seeded Representatives ---');
  console.table(sample);

  const [partySummary] = await db.query(`
    SELECT party, COUNT(*) as count
    FROM governing_representatives
    WHERE is_deleted = 0
    GROUP BY party
  `);
  console.log('--- Party Breakdown ---');
  console.table(partySummary);

  process.exit(0);
}

verify().catch(e => { console.error(e); process.exit(1); });
