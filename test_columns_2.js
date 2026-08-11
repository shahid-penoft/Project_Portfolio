import pool from './configs/db.js';
async function test() {
  const [rows] = await pool.query('SHOW COLUMNS FROM complaints');
  console.log('complaints columns:', rows.map(r => r.Field));
  
  const [rows2] = await pool.query('SHOW COLUMNS FROM cm_fund_requests');
  console.log('cm_fund_requests columns:', rows2.map(r => r.Field));
  
  process.exit(0);
}
test();
