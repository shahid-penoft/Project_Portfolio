import pool from './configs/db.js';

async function run() {
  const [rows] = await pool.query('SELECT * FROM message_templates');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
