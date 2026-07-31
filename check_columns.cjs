require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSchema() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [rows] = await db.query('DESCRIBE complaints;');
  console.log('COMPLAINTS SCHEMA:');
  console.table(rows.filter(r => ['status', 'priority', 'category'].includes(r.Field)));
  
  const [issuesRows] = await db.query('DESCRIBE issues;');
  console.log('\nISSUES SCHEMA:');
  console.table(issuesRows.filter(r => ['status', 'priority', 'category'].includes(r.Field)));
  
  const [ideasRows] = await db.query('DESCRIBE ideas;');
  console.log('\nIDEAS SCHEMA:');
  console.table(ideasRows.filter(r => ['status', 'priority', 'category'].includes(r.Field)));
  
  const [suggestionsRows] = await db.query('DESCRIBE suggestions;');
  console.log('\nSUGGESTIONS SCHEMA:');
  console.table(suggestionsRows.filter(r => ['status', 'priority', 'category'].includes(r.Field)));

  process.exit(0);
}

checkSchema();
