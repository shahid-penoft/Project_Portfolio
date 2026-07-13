import pool from './configs/db.js';

async function run() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 1. Check if 'cm_fund_category' dropdown key exists, if not create it
    const [existing] = await connection.query('SELECT id FROM mla_dropdown_lists WHERE `key` = ?', ['cm_fund_category']);
    let rootId;
    if (existing.length === 0) {
      const [res] = await connection.query('INSERT INTO mla_dropdown_lists (`key`, module, label, value) VALUES (?, ?, ?, ?)', ['cm_fund_category', 'CM Funds', 'CM Fund Categories', 'cm_fund_category']);
      rootId = res.insertId;
    } else {
      rootId = existing[0].id;
    }

    // 2. Fetch existing categories
    const [cats] = await connection.query('SELECT * FROM cm_fund_categories');
    
    // 3. Create General and CMDRF roots
    await connection.query('INSERT IGNORE INTO mla_dropdown_lists (parent_id, `key`, module, value, label) VALUES (?, ?, ?, ?, ?)', [rootId, 'cm_fund_category', 'CM Funds', 'General', 'General']);
    await connection.query('INSERT IGNORE INTO mla_dropdown_lists (parent_id, `key`, module, value, label) VALUES (?, ?, ?, ?, ?)', [rootId, 'cm_fund_category', 'CM Funds', 'CMDRF', 'CMDRF']);
    
    const [genRoot] = await connection.query('SELECT id FROM mla_dropdown_lists WHERE value = ? AND parent_id = ?', ['General', rootId]);
    const [cmdRoot] = await connection.query('SELECT id FROM mla_dropdown_lists WHERE value = ? AND parent_id = ?', ['CMDRF', rootId]);
    
    const generalId = genRoot[0].id;
    const cmdrfId = cmdRoot[0].id;

    // 4. Map existing categories to CMDRF parent by default (or General if they have general in name)
    const oldIdToNewId = {};
    for (const c of cats) {
      const isGeneral = c.name.toLowerCase().includes('general');
      const pid = isGeneral ? generalId : cmdrfId;
      const [ins] = await connection.query('INSERT INTO mla_dropdown_lists (parent_id, `key`, module, value, label) VALUES (?, ?, ?, ?, ?)', [pid, 'cm_fund_category', 'CM Funds', c.name, c.name]);
      oldIdToNewId[c.id] = ins.insertId;
    }

    // 5. Update cm_fund_category_document_config
    // Drop foreign key
    const [fks] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cm_fund_category_document_config' AND REFERENCED_TABLE_NAME = 'cm_fund_categories'");
    if (fks.length > 0) {
      await connection.query('ALTER TABLE cm_fund_category_document_config DROP FOREIGN KEY ' + fks[0].CONSTRAINT_NAME);
    }
    
    // Update IDs
    const [configs] = await connection.query('SELECT * FROM cm_fund_category_document_config');
    for (const conf of configs) {
      if (oldIdToNewId[conf.category_id]) {
         await connection.query('UPDATE cm_fund_category_document_config SET category_id = ? WHERE id = ?', [oldIdToNewId[conf.category_id], conf.id]);
      }
    }

    // 6. Update cm_fund_requests
    const [fks2] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cm_fund_requests' AND REFERENCED_TABLE_NAME = 'cm_fund_categories'");
    if (fks2.length > 0) {
      await connection.query('ALTER TABLE cm_fund_requests DROP FOREIGN KEY ' + fks2[0].CONSTRAINT_NAME);
    }

    const [reqs] = await connection.query('SELECT id, category_id FROM cm_fund_requests');
    for (const r of reqs) {
      if (r.category_id && oldIdToNewId[r.category_id]) {
         await connection.query('UPDATE cm_fund_requests SET category_id = ? WHERE id = ?', [oldIdToNewId[r.category_id], r.id]);
      }
    }

    // Drop old table
    await connection.query('DROP TABLE IF EXISTS cm_fund_categories');
    
    // Add new foreign keys
    await connection.query('ALTER TABLE cm_fund_category_document_config ADD CONSTRAINT fk_cm_fund_cat_doc FOREIGN KEY (category_id) REFERENCES mla_dropdown_lists(id) ON DELETE CASCADE');
    await connection.query('ALTER TABLE cm_fund_requests ADD CONSTRAINT fk_cm_fund_req_cat FOREIGN KEY (category_id) REFERENCES mla_dropdown_lists(id) ON DELETE SET NULL');
    
    await connection.commit();
    console.log('Migration successful');
  } catch (err) {
    await connection.rollback();
    console.error('Migration failed:', err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

run();
