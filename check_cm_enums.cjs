require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkCMFund() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [tables] = await db.query("SHOW TABLES");
  const allTables = tables.map(t => Object.values(t)[0]);
  const cmTables = allTables.filter(t => t.includes('cm') || t.includes('fund'));
  console.log('All CM/Fund related tables:', cmTables);

  for (const t of cmTables) {
    try {
      const [r] = await db.query(`DESCRIBE ${t}`);
      const relevant = r.filter(c => ['status', 'priority', 'category', 'type', 'application_type'].includes(c.Field));
      if (relevant.length) {
        const enumCols = relevant.filter(c => c.Type.startsWith('enum'));
        if (enumCols.length) {
          console.log(`\n⚠ ENUM found in ${t.toUpperCase()}:`);
          console.table(enumCols.map(c => ({ Field: c.Field, Type: c.Type, Default: c.Default })));
        } else {
          console.log(`✅ ${t}: VARCHAR (safe)`);
        }
      }
    } catch (e) {
      console.log(`Error checking ${t}: ${e.message}`);
    }
  }
  process.exit(0);
}

checkCMFund();
