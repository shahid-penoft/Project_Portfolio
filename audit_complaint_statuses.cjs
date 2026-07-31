require('dotenv').config();
const mysql = require('mysql2/promise');

async function audit() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // 1. Get valid status values from dropdown manager for complaint_status
  const [validRows] = await db.query(
    `SELECT value FROM mla_dropdown_lists WHERE \`key\` = 'complaint_status' AND status = 'Active'`
  );
  const validValues = validRows.map(r => r.value);
  console.log('\n✅ Valid complaint_status options in Dropdown Manager:');
  console.log(validValues);

  // 2. Get all distinct status values currently stored in complaints
  const [usedRows] = await db.query(
    `SELECT status, COUNT(*) AS count FROM complaints WHERE is_deleted = 0 GROUP BY status ORDER BY count DESC`
  );
  console.log('\n📋 All status values currently in complaints table:');
  console.table(usedRows);

  // 3. Find orphaned (Not Available) statuses — in DB but not in dropdown manager
  const orphaned = usedRows.filter(r => !validValues.includes(r.status));
  console.log('\n⚠ Orphaned (Not Available) status values in complaints:');
  if (orphaned.length === 0) {
    console.log('  None found.');
  } else {
    console.table(orphaned);
    const totalAffected = orphaned.reduce((sum, r) => sum + Number(r.count), 0);
    console.log(`  Total records affected: ${totalAffected}`);
  }

  process.exit(0);
}

audit();
