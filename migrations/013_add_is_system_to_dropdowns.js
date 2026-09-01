import pool from '../configs/db.js';

async function runMigration() {
  const connection = await pool.getConnection();
  try {
    console.log('🔄 Checking if is_system column exists in mla_dropdown_lists...');
    const [cols] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'mla_dropdown_lists' 
        AND COLUMN_NAME = 'is_system'
    `);

    if (cols.length === 0) {
      console.log('➕ Adding is_system column to mla_dropdown_lists...');
      await connection.query(`
        ALTER TABLE mla_dropdown_lists 
        ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0
      `);
      console.log('✅ Added is_system column.');
    } else {
      console.log('ℹ️ is_system column already exists.');
    }

    const statusKeys = [
      { key: 'complaint_status', module: 'Complaints' },
      { key: 'issue_status', module: 'Issues' },
      { key: 'idea_status', module: 'Ideas' },
      { key: 'suggestion_status', module: 'Suggestions' },
      { key: 'cmfund_status', module: 'CM Funds' },
    ];

    for (const { key, module } of statusKeys) {
      const [existing] = await connection.query(
        'SELECT id FROM mla_dropdown_lists WHERE `key` = ? AND `value` = ? LIMIT 1',
        [key, 'Draft']
      );

      if (existing.length > 0) {
        await connection.query(
          'UPDATE mla_dropdown_lists SET is_system = 1 WHERE id = ?',
          [existing[0].id]
        );
        console.log(`✅ Marked existing 'Draft' as is_system=1 for ${key}`);
      } else {
        await connection.query(`
          INSERT INTO mla_dropdown_lists (\`key\`, module, sub_category, label, value, color, sort_order, status, is_system)
          VALUES (?, ?, 'Status', 'Draft', 'Draft', 'gray', 99, 'Active', 1)
        `, [key, module]);
        console.log(`➕ Inserted system 'Draft' for ${key}`);
      }
    }

    console.log('🎉 Migration 013 completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration();
