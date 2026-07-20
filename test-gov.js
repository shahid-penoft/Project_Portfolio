import { governingService } from '../Portfolio_challange_frontend_B12_Team_A/src/services/governingService.js';
// Actually, it's easier to just query the DB directly in a node script
import db from './configs/db.js';
async function run() {
  const [rows] = await db.query(\
    SELECT 
        gr.*,
        gr.created_at AS createdAt,
        lb.name AS local_body_name,
        d.name AS role_name,
        w.name AS ward_name
    FROM governing_representatives gr
    LEFT JOIN local_bodies lb ON gr.local_body_id = lb.id
    LEFT JOIN dropdowns d ON gr.role_id = d.id
    LEFT JOIN dropdowns w ON gr.ward_id = w.id
    LIMIT 1
  \);
  console.log(rows);
  process.exit();
}
run();
