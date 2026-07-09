import pool from './configs/db.js';

const addIfMissing = async (table, column, definition) => {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (cols.length === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ Added column ${column} to ${table}`);
  } else {
    console.log(`ℹ️  Column ${column} already exists on ${table}`);
  }
};

try {
  await addIfMissing('governing_representatives', 'status', "VARCHAR(20) NOT NULL DEFAULT 'Active'");
  console.log('Migration complete.');
} catch (err) {
  console.error('Migration error:', err.message);
}
process.exit(0);
