import db from './configs/db.js';

async function check() {
  const [projects] = await db.query('SELECT * FROM projects WHERE slug = ?', ['tester-for-activity-logs-and-project-updates']);
  if (!projects.length) {
    console.log("Project not found");
    process.exit();
  }
  const p = projects[0];
  console.log("Project Details:");
  console.log("created_at:", p.created_at);
  console.log("updated_at:", p.updated_at);
  console.log("created_by:", p.created_by);
  console.log("updated_by:", p.updated_by);
  
  process.exit();
}
check();
