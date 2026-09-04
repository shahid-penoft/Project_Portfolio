require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const [res] = await db.query(
    "UPDATE mla_dropdown_lists SET status = 'Disabled' WHERE `key` IN ('complaint_category', 'issue_category', 'idea_category', 'suggestion_category')"
  );
  console.log(`Updated ${res.affectedRows} legacy dropdown items to Disabled.`);
  process.exit(0);
})();
