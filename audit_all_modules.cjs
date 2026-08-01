require('dotenv').config();
const mysql = require('mysql2/promise');

// All cascade-mapped tables and columns from mlaDropdownsController.js
const CASCADE_MAP = {
  complaint_priority:  { table: 'complaints',       col: 'priority',  deletedCol: 'is_deleted' },
  complaint_status:    { table: 'complaints',       col: 'status',    deletedCol: 'is_deleted' },
  complaint_category:  { table: 'complaints',       col: 'category',  deletedCol: 'is_deleted' },
  issue_priority:      { table: 'issues',           col: 'priority',  deletedCol: 'is_deleted' },
  issue_status:        { table: 'issues',           col: 'status',    deletedCol: 'is_deleted' },
  issue_category:      { table: 'issues',           col: 'category',  deletedCol: 'is_deleted' },
  idea_priority:       { table: 'ideas',            col: 'priority',  deletedCol: 'is_deleted' },
  idea_status:         { table: 'ideas',            col: 'status',    deletedCol: 'is_deleted' },
  idea_category:       { table: 'ideas',            col: 'category',  deletedCol: 'is_deleted' },
  suggestion_priority: { table: 'suggestions',      col: 'priority',  deletedCol: 'is_deleted' },
  suggestion_status:   { table: 'suggestions',      col: 'status',    deletedCol: 'is_deleted' },
  suggestion_category: { table: 'suggestions',      col: 'category',  deletedCol: 'is_deleted' },
  csr_status:          { table: 'csr_organisations', col: 'status',   deletedCol: 'deleted'    },
  csr_org_type:        { table: 'csr_organisations', col: 'type',     deletedCol: 'deleted'    },
  csr_followup_type:   { table: 'csr_followups',    col: 'type',      deletedCol: null         },
  csr_report_type:     { table: 'csr_reports',      col: 'type',      deletedCol: null         },
};

async function fullAudit() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const issues = [];
  console.log('\n====== Full Empty-String Audit Across All Cascade-Mapped Columns ======\n');

  for (const [dropdownKey, { table, col, deletedCol }] of Object.entries(CASCADE_MAP)) {
    try {
      const whereDeleted = deletedCol ? `AND \`${deletedCol}\` = 0` : '';

      // Count empty-string records
      const [[{ emptyCount }]] = await db.query(
        `SELECT COUNT(*) AS emptyCount FROM \`${table}\` WHERE \`${col}\` = '' ${whereDeleted}`
      );

      // Also count valid dropdown values vs orphaned
      const [validRows] = await db.query(
        `SELECT value FROM mla_dropdown_lists WHERE \`key\` = ? AND status = 'Active'`,
        [dropdownKey]
      );
      const validVals = validRows.map(r => r.value);

      const [allVals] = await db.query(
        `SELECT \`${col}\` AS val, COUNT(*) AS count FROM \`${table}\` WHERE \`${col}\` != '' ${whereDeleted} GROUP BY \`${col}\``
      );

      const orphaned = allVals.filter(r => r.val && !validVals.includes(r.val));
      const totalOrphaned = orphaned.reduce((s, r) => s + Number(r.count), 0);

      if (Number(emptyCount) > 0 || orphaned.length > 0) {
        console.log(`⚠  [${dropdownKey}] → ${table}.${col}`);
        if (Number(emptyCount) > 0) {
          console.log(`     Empty string (''): ${emptyCount} records`);
          issues.push({ dropdownKey, table, col, deletedCol, emptyCount: Number(emptyCount), orphaned });
        }
        if (orphaned.length > 0) {
          console.log(`     Orphaned values (${totalOrphaned} records):`, orphaned.map(o => `"${o.val}" (${o.count})`).join(', '));
          if (!issues.find(i => i.dropdownKey === dropdownKey)) {
            issues.push({ dropdownKey, table, col, deletedCol, emptyCount: Number(emptyCount), orphaned });
          }
        }
      } else {
        console.log(`✅  [${dropdownKey}] → ${table}.${col}: clean`);
      }
    } catch (err) {
      console.log(`❌  [${dropdownKey}] → ${table}.${col}: ERROR — ${err.message}`);
    }
  }

  console.log('\n====== Summary ======');
  if (issues.length === 0) {
    console.log('✅ All modules are clean. No empty-string or orphaned records found.');
  } else {
    console.log(`\n⚠  ${issues.length} column(s) need attention:\n`);
    for (const { dropdownKey, table, col, emptyCount, orphaned } of issues) {
      const orphanTotal = orphaned.reduce((s, r) => s + Number(r.count), 0);
      console.log(`  • ${dropdownKey} (${table}.${col}): ${emptyCount} empty + ${orphanTotal} orphaned`);
    }
  }

  process.exit(0);
}

fullAudit();
