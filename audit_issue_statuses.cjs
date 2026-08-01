require('dotenv').config();
const mysql = require('mysql2/promise');

async function auditIssueStatuses() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // 1. Current dropdown values for issue_status
  const [dropdownRows] = await db.query(
    "SELECT id, value, label, status FROM mla_dropdown_lists WHERE `key` = 'issue_status' ORDER BY sort_order"
  );
  console.log('\n✅ Current issue_status in Dropdown Manager:');
  console.table(dropdownRows);

  // 2. Distinct status values actually stored in issues table
  const [issueRows] = await db.query(
    `SELECT status, COUNT(*) AS count FROM issues WHERE is_deleted = 0 GROUP BY status ORDER BY count DESC`
  );
  console.log('\n📋 Current status values in issues table:');
  console.table(issueRows);

  // 3. Orphaned (in DB but not in dropdown)
  const validValues = dropdownRows.filter(r => r.status === 'Active').map(r => r.value);
  const orphaned = issueRows.filter(r => r.status && !validValues.includes(r.status));
  if (orphaned.length) {
    console.log('\n⚠ Orphaned (Not Available) statuses in issues:');
    console.table(orphaned);
  } else {
    console.log('\n✅ No orphaned statuses in issues table');
  }

  // 4. Check the dropdown history / rename log
  const [allDropdownHistory] = await db.query(
    "SELECT id, `key`, value, label, status, updated_at FROM mla_dropdown_lists WHERE `key` = 'issue_status' ORDER BY id"
  );
  console.log('\n📜 Full dropdown history for issue_status (all rows including inactive):');
  console.table(allDropdownHistory.map(r => ({ id: r.id, value: r.value, status: r.status })));

  process.exit(0);
}

auditIssueStatuses();
