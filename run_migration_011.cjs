require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  const sqlPath = path.join(__dirname, 'migrations', '011_testimonial_requests.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8')
    .split('\n')
    .filter(l => !l.trim().startsWith('--') && l.trim() !== '')
    .join('\n');

  console.log('Running migration 011 (testimonial requests)...');
  try {
    await db.query(sql);
    console.log('✅ Migration 011 complete!');
    // Verify
    const [cols] = await db.query('SHOW COLUMNS FROM ente_nadu_testimonials');
    const names = cols.map(c => c.Field).join(', ');
    console.log('Columns:', names);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  }
  process.exit(0);
}

run();