import pool from './configs/db.js';

async function fix() {
  try {
    // Check if column exists first (to be safe, though we know it doesn't from the error)
    await pool.query("ALTER TABLE cm_fund_updates ADD COLUMN notify_complainant TINYINT(1) DEFAULT 0");
    console.log("Added notify_complainant column to cm_fund_updates");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
       console.log("Column already exists!");
    } else {
       console.error("Error fixing", err);
    }
  } finally {
    process.exit(0);
  }
}
fix();
