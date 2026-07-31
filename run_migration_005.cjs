require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  const sqlPath = path.join(__dirname, 'migrations', '005_convert_cm_fund_enums_to_varchar.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // Strip comment-only lines to avoid multistatement issues
  const cleanSql = sql.split('\n').filter(l => !l.trim().startsWith('--') && l.trim() !== '').join('\n');

  console.log('Running CM Fund ENUM migration...');
  try {
    const [result] = await db.query(cleanSql);
    console.log('Migration successful!');
    console.log(Array.isArray(result) ? result.map(r => `Affected rows: ${r.affectedRows}`).join('\n') : `Affected rows: ${result.affectedRows}`);
  } catch (error) {
    console.error('Migration failed:', error.message);
  }
  process.exit(0);
}

runMigration();
