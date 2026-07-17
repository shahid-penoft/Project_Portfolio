import pool from './configs/db.js';

const addColumnIfMissing = async (conn, table, column, definition) => {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows.length === 0) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`  + Added column ${column}`);
  } else {
    console.log(`  · Column ${column} already exists — skipped.`);
  }
};

const addIndexIfMissing = async (conn, table, indexName, columns) => {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  if (rows.length === 0) {
    await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
    console.log(`  + Added index ${indexName}`);
  } else {
    console.log(`  · Index ${indexName} already exists — skipped.`);
  }
};

const run = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('Adding soft-delete columns to cm_fund_requests...');
    await addColumnIfMissing(connection, 'cm_fund_requests', 'is_deleted',    'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing(connection, 'cm_fund_requests', 'deleted_at',    'DATETIME NULL DEFAULT NULL');
    await addColumnIfMissing(connection, 'cm_fund_requests', 'deleted_by_id', 'INT UNSIGNED NULL DEFAULT NULL');
    await addIndexIfMissing(connection,  'cm_fund_requests', 'idx_cm_fund_is_deleted', '`is_deleted`');
    console.log('✅  Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    connection.release();
    process.exit(0);
  }
};

run();
