import db from './configs/db.js';

async function check() {
  const [projects] = await db.query('SELECT id, title FROM projects WHERE slug = ?', ['tester-for-activity-logs-and-project-updates']);
  if (!projects.length) {
    console.log("Project not found");
    process.exit();
  }
  const pid = projects[0].id;
  console.log("Project ID:", pid);

  const [logs] = await db.query('SELECT * FROM project_activity_logs WHERE project_id = ?', [pid]);
  console.log("Activity logs count:", logs.length);
  
  process.exit();
}
check();
