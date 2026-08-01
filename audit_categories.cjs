require('dotenv').config();
const mysql = require('mysql2/promise');

async function auditCategories() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [validRows] = await db.query(
    "SELECT value FROM mla_dropdown_lists WHERE `key` = 'system_category' AND status = 'Active'"
  );
  const validCats = validRows.map(r => r.value);
  console.log('\n✅ Valid system_category options in Dropdown Manager:', validCats);

  for (const t of ['complaints', 'issues', 'ideas', 'suggestions']) {
    const [rows] = await db.query(
      `SELECT category, COUNT(*) as count FROM ${t} WHERE is_deleted = 0 GROUP BY category ORDER BY count DESC`
    );
    const noCat = rows.filter(r => !r.category || r.category === '');
    const orphaned = rows.filter(r => r.category && r.category !== '' && !validCats.includes(r.category));
    const valid = rows.filter(r => r.category && validCats.includes(r.category));
    
    console.log(`\n=== ${t.toUpperCase()} ===`);
    console.log(`  Valid categories: ${valid.map(r => `"${r.category}" (${r.count})`).join(', ') || 'none'}`);
    console.log(`  No category (null/empty): ${noCat.reduce((s, r) => s + Number(r.count), 0)} records`);
    if (orphaned.length) {
      console.log(`  ⚠ Orphaned categories:`);
      console.table(orphaned);
    } else {
      console.log(`  ✅ No orphaned categories`);
    }
  }

  process.exit(0);
}

auditCategories();
