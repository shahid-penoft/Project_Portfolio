import 'dotenv/config';
import db from '../configs/db.js';

async function checkProjects() {
  const [cols] = await db.query("SHOW FULL COLUMNS FROM projects WHERE Field = 'completion_percentage'");
  console.log('--- completion_percentage Column in projects ---');
  console.table(cols);
  process.exit(0);
}

checkProjects().catch(e => { console.error(e); process.exit(1); });
