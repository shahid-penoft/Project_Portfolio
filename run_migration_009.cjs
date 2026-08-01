require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  const sqlPath = path.join(__dirname, 'migrations', '009_fix_empty_category_records.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8')
    .split('\n')
    .filter(l => !l.trim().startsWith('--') && l.trim() !== '')
    .join('\n');

  console.log('Running migration 009...');
  try {
    const [results] = await db.query(sql);
    const arr = Array.isArray(results) ? results : [results];
    const tables = ['complaints', 'issues', 'ideas', 'suggestions'];
    arr.forEach((r, i) => {
      if (r && r.affectedRows !== undefined) {
        console.log(`  ${tables[i] || `Statement ${i+1}`}: ${r.affectedRows} rows fixed`);
      }
    });
    console.log('✅ Migration 009 complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  }
  process.exit(0);
}

run();
