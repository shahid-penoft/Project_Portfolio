import pool from '../configs/db.js';

async function check() {
  const [rows] = await pool.query('DESCRIBE admin_users');
  console.table(rows);
  pool.end();
}
check();
