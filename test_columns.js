import db from './configs/db.js';

async function check() {
  const [columns] = await db.query('SHOW COLUMNS FROM projects');
  console.log("Columns in projects table:");
  columns.forEach(c => console.log(c.Field));
  process.exit();
}
check();
