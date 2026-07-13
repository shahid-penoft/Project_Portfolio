import pool from './configs/db.js';

async function run() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create cm_fund_categories
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cm_fund_categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        application_type ENUM('General', 'CMDRF') NOT NULL DEFAULT 'General',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_name_app_type (name, application_type)
      )
    `);

    // 2. Drop the existing mla_dropdown_lists foreign keys if they exist
    const [fks] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cm_fund_category_document_config' AND REFERENCED_TABLE_NAME = 'mla_dropdown_lists'");
    if (fks.length > 0) {
      await connection.query('ALTER TABLE cm_fund_category_document_config DROP FOREIGN KEY ' + fks[0].CONSTRAINT_NAME);
    }

    const [fks2] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cm_fund_requests' AND REFERENCED_TABLE_NAME = 'mla_dropdown_lists'");
    if (fks2.length > 0) {
      await connection.query('ALTER TABLE cm_fund_requests DROP FOREIGN KEY ' + fks2[0].CONSTRAINT_NAME);
    }

    // Clear out orphaned configs and set requests category_id to NULL before adding FKs
    await connection.query('DELETE FROM cm_fund_category_document_config');
    await connection.query('UPDATE cm_fund_requests SET category_id = NULL');

    // 3. Re-add foreign keys pointing to cm_fund_categories
    await connection.query('ALTER TABLE cm_fund_category_document_config ADD CONSTRAINT fk_legacy_cat_doc FOREIGN KEY (category_id) REFERENCES cm_fund_categories(id) ON DELETE CASCADE');
    await connection.query('ALTER TABLE cm_fund_requests ADD CONSTRAINT fk_legacy_req_cat FOREIGN KEY (category_id) REFERENCES cm_fund_categories(id) ON DELETE SET NULL');

    await connection.commit();
    console.log('Revert migration successful');
  } catch (err) {
    await connection.rollback();
    console.error('Revert migration failed:', err);
  } finally {
    connection.release();
    process.exit(0);
  }
}

run();
