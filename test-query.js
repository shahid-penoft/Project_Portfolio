import db from './configs/db.js';
async function run() {
  const [rows] = await db.query('DESCRIBE local_bodies');
  console.log(rows);
  process.exit();
}
run();
