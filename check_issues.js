import pool from './configs/db.js';

async function checkIssues() {
  const [rows] = await pool.query('SELECT id, reference_no FROM issues');
  console.log(rows);
  const [[{ maxSeq }]] = await pool.query('SELECT COALESCE(MAX(CAST(SUBSTRING(reference_no, 3) AS UNSIGNED)), 0) as maxSeq FROM issues WHERE reference_no LIKE "P-%"');
  console.log('Max seq:', maxSeq);
  process.exit(0);
}
checkIssues();
