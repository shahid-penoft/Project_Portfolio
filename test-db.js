import pool from './config/db.js';
async function run() {
  const [rows] = await pool.query("SELECT c.id, (SELECT JSON_OBJECT('id', id, 'title', title, 'created_at', created_at) FROM complaint_updates WHERE complaint_id = c.id ORDER BY created_at DESC LIMIT 1) as last_update FROM complaints c LIMIT 1");
  console.log(rows);
  process.exit(0);
}
run();
