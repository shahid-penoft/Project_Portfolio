import db from './configs/db.js';

async function check() {
  const [logs] = await db.query('SELECT * FROM project_activity_logs');
  console.log("Total activity logs in DB:", logs.length);
  
  if (logs.length > 0) {
    console.log("Sample log:", logs[0]);
  }
  process.exit();
}
check();
