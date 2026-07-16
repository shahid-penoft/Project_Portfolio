import pool from './configs/db.js';
async function run() {
  try {
    await pool.query('ALTER TABLE issues ADD COLUMN issue_scope ENUM("Individual Issue", "Public/Group Issue") DEFAULT "Individual Issue" AFTER category;');
    console.log('Column added');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
