import 'dotenv/config';
import db from '../configs/db.js';

async function migrate() {
  console.log('--- Starting Migration: Add party to governing_representatives ---');

  // 1. Check if column exists
  const [cols] = await db.query("SHOW COLUMNS FROM governing_representatives LIKE 'party'");
  if (cols.length === 0) {
    console.log('Adding `party` column to `governing_representatives`...');
    await db.query(`
      ALTER TABLE governing_representatives 
      ADD COLUMN party VARCHAR(100) NULL AFTER role_id
    `);
    console.log('✅ Column `party` added successfully.');
  } else {
    console.log('ℹ️ Column `party` already exists.');
  }

  // 2. Add Party options into mla_dropdown_lists if not present
  const parties = ['LDF', 'UDF', 'BJP'];
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    const [existing] = await db.query(
      "SELECT id FROM mla_dropdown_lists WHERE `key` = 'governing_party' AND `value` = ?",
      [party]
    );
    if (existing.length === 0) {
      console.log(`Adding '${party}' to mla_dropdown_lists...`);
      await db.query(`
        INSERT INTO mla_dropdown_lists (
          \`key\`, \`module\`, \`sub_category\`, \`label\`, \`value\`, \`parent_id\`, \`sort_order\`, \`is_default\`, \`status\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'governing_party',
        'Governing Bodies',
        'System-wide',
        party,
        party,
        0,
        i + 1,
        0,
        'Active'
      ]);
      console.log(`✅ '${party}' inserted into mla_dropdown_lists.`);
    } else {
      console.log(`ℹ️ '${party}' already in mla_dropdown_lists.`);
    }
  }

  console.log('--- Migration completed successfully! ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
