import pool from '../configs/db.js';

/**
 * Migration script to safely add B-Tree and FULLTEXT search indexes
 * across all core communication/citizen modules.
 */

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count 
     FROM information_schema.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = ? 
       AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows[0].count > 0;
}

async function addIndexSafe(connection, tableName, indexName, ddlQuery) {
  try {
    const exists = await indexExists(connection, tableName, indexName);
    if (exists) {
      console.log(`  ℹ️ Index '${indexName}' already exists on '${tableName}'. Skipping.`);
      return;
    }
    console.log(`  ➕ Adding index '${indexName}' on '${tableName}'...`);
    await connection.query(ddlQuery);
    console.log(`  ✅ Successfully added '${indexName}' on '${tableName}'.`);
  } catch (err) {
    console.warn(`  ⚠️ Failed to add index '${indexName}' on '${tableName}':`, err.message);
  }
}

async function runMigration() {
  console.log('🚀 Starting Communications Search Index Migration...\n');
  const connection = await pool.getConnection();

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. COMPLAINTS TABLE
    // ─────────────────────────────────────────────────────────────
    console.log('📌 1. Indexing table: complaints');
    await addIndexSafe(connection, 'complaints', 'idx_comp_phone', 
      'ALTER TABLE complaints ADD INDEX idx_comp_phone (phone)');
    await addIndexSafe(connection, 'complaints', 'idx_comp_alt_phone', 
      'ALTER TABLE complaints ADD INDEX idx_comp_alt_phone (alternative_phone)');
    await addIndexSafe(connection, 'complaints', 'idx_comp_email', 
      'ALTER TABLE complaints ADD INDEX idx_comp_email (email)');
    await addIndexSafe(connection, 'complaints', 'idx_comp_search_composite', 
      'ALTER TABLE complaints ADD INDEX idx_comp_search_composite (is_deleted, local_body_id, ward_id, date_filed)');
    await addIndexSafe(connection, 'complaints', 'ft_complaints_citizen', 
      'ALTER TABLE complaints ADD FULLTEXT INDEX ft_complaints_citizen (complainant_name, location)');

    // ─────────────────────────────────────────────────────────────
    // 2. ISSUES TABLE
    // ─────────────────────────────────────────────────────────────
    console.log('\n📌 2. Indexing table: issues');
    await addIndexSafe(connection, 'issues', 'idx_issues_phone', 
      'ALTER TABLE issues ADD INDEX idx_issues_phone (phone)');
    await addIndexSafe(connection, 'issues', 'idx_issues_alt_phone', 
      'ALTER TABLE issues ADD INDEX idx_issues_alt_phone (alternative_phone)');
    await addIndexSafe(connection, 'issues', 'idx_issues_email', 
      'ALTER TABLE issues ADD INDEX idx_issues_email (email)');
    await addIndexSafe(connection, 'issues', 'idx_issues_search_composite', 
      'ALTER TABLE issues ADD INDEX idx_issues_search_composite (is_deleted, local_body_id, ward_id, date_filed)');
    await addIndexSafe(connection, 'issues', 'ft_issues_citizen', 
      'ALTER TABLE issues ADD FULLTEXT INDEX ft_issues_citizen (submitter_name, location)');

    // ─────────────────────────────────────────────────────────────
    // 3. IDEAS TABLE
    // ─────────────────────────────────────────────────────────────
    console.log('\n📌 3. Indexing table: ideas');
    await addIndexSafe(connection, 'ideas', 'idx_ideas_phone', 
      'ALTER TABLE ideas ADD INDEX idx_ideas_phone (phone)');
    await addIndexSafe(connection, 'ideas', 'idx_ideas_alt_phone', 
      'ALTER TABLE ideas ADD INDEX idx_ideas_alt_phone (alternative_phone)');
    await addIndexSafe(connection, 'ideas', 'idx_ideas_email', 
      'ALTER TABLE ideas ADD INDEX idx_ideas_email (email)');
    await addIndexSafe(connection, 'ideas', 'idx_ideas_search_composite', 
      'ALTER TABLE ideas ADD INDEX idx_ideas_search_composite (is_deleted, local_body_id, ward_id, date_filed)');
    await addIndexSafe(connection, 'ideas', 'ft_ideas_citizen', 
      'ALTER TABLE ideas ADD FULLTEXT INDEX ft_ideas_citizen (complainant_name, location)');

    // ─────────────────────────────────────────────────────────────
    // 4. SUGGESTIONS TABLE
    // ─────────────────────────────────────────────────────────────
    console.log('\n📌 4. Indexing table: suggestions');
    await addIndexSafe(connection, 'suggestions', 'idx_sugg_phone', 
      'ALTER TABLE suggestions ADD INDEX idx_sugg_phone (phone)');
    await addIndexSafe(connection, 'suggestions', 'idx_sugg_alt_phone', 
      'ALTER TABLE suggestions ADD INDEX idx_sugg_alt_phone (alternative_phone)');
    await addIndexSafe(connection, 'suggestions', 'idx_sugg_email', 
      'ALTER TABLE suggestions ADD INDEX idx_sugg_email (email)');
    await addIndexSafe(connection, 'suggestions', 'idx_sugg_search_composite', 
      'ALTER TABLE suggestions ADD INDEX idx_sugg_search_composite (is_deleted, local_body_id, ward_id, date_filed)');
    await addIndexSafe(connection, 'suggestions', 'ft_sugg_citizen', 
      'ALTER TABLE suggestions ADD FULLTEXT INDEX ft_sugg_citizen (complainant_name, location)');

    // ─────────────────────────────────────────────────────────────
    // 5. CM FUND REQUESTS TABLE
    // ─────────────────────────────────────────────────────────────
    console.log('\n📌 5. Indexing table: cm_fund_requests');
    await addIndexSafe(connection, 'cm_fund_requests', 'idx_cm_phone', 
      'ALTER TABLE cm_fund_requests ADD INDEX idx_cm_phone (applicant_phone)');
    await addIndexSafe(connection, 'cm_fund_requests', 'idx_cm_alt_phone', 
      'ALTER TABLE cm_fund_requests ADD INDEX idx_cm_alt_phone (alternate_phone)');
    await addIndexSafe(connection, 'cm_fund_requests', 'idx_cm_search_composite', 
      'ALTER TABLE cm_fund_requests ADD INDEX idx_cm_search_composite (is_deleted, local_body_id, ward_id, created_at)');
    await addIndexSafe(connection, 'cm_fund_requests', 'ft_cm_funds_citizen', 
      'ALTER TABLE cm_fund_requests ADD FULLTEXT INDEX ft_cm_funds_citizen (applicant_name, address_line1, address, location)');

    console.log('\n🎉 Communications search indexing migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration();
