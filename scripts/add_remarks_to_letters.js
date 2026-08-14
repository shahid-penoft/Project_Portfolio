import pool from '../configs/db.js';

async function migrate() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM mla_letters LIKE 'remarks'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE mla_letters ADD COLUMN remarks TEXT DEFAULT NULL");
      console.log("Successfully added remarks column to mla_letters");
    } else {
      console.log("remarks column already exists on mla_letters");
    }
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    process.exit(0);
  }
}

migrate();
