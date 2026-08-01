require('dotenv').config();
const mysql = require('mysql2/promise');

// For categories, the actual dropdown key is system_category (shared across all modules)
// Complaint/Issue/Idea/Suggestion categories all use the same dropdown
async function categoryClarification() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [validCats] = await db.query(
    "SELECT value FROM mla_dropdown_lists WHERE `key` = 'system_category' AND status = 'Active'"
  );
  const validVals = validCats.map(r => r.value);

  for (const [table, col] of [['complaints','category'],['issues','category'],['ideas','category'],['suggestions','category']]) {
    const [[{ emptyCount }]] = await db.query(
      `SELECT COUNT(*) AS emptyCount FROM \`${table}\` WHERE \`${col}\` = '' AND is_deleted = 0`
    );
    const [allVals] = await db.query(
      `SELECT \`${col}\` AS val, COUNT(*) AS count FROM \`${table}\` WHERE \`${col}\` != '' AND \`${col}\` IS NOT NULL AND is_deleted = 0 GROUP BY \`${col}\``
    );
    const orphaned = allVals.filter(r => !validVals.includes(r.val));
    const trueValid = allVals.filter(r => validVals.includes(r.val));

    console.log(`\n--- ${table}.${col} ---`);
    console.log(`  Empty string (''): ${emptyCount} records`);
    console.log(`  Valid categories: ${trueValid.map(r => `"${r.val}" (${r.count})`).join(', ') || 'none'}`);
    console.log(`  Truly orphaned (deleted from dropdown): ${orphaned.map(r => `"${r.val}" (${r.count})`).join(', ') || 'none'}`);
  }

  process.exit(0);
}

categoryClarification();
