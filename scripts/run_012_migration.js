import db from '../configs/db.js';

async function runMigration() {
  console.log('🚀 Running 012_update_geo_locations_local_body_mapping migration...');
  try {
    // 1. Ensure local_body_id column exists
    const [cols] = await db.query("SHOW COLUMNS FROM geo_locations LIKE 'local_body_id'");
    if (cols.length === 0) {
      await db.query("ALTER TABLE geo_locations ADD COLUMN local_body_id INT NULL AFTER history_details");
      console.log('✅ Added local_body_id column to geo_locations');
    } else {
      console.log('ℹ️ Column local_body_id already exists');
    }

    // 2. Update records mapped to Kothamangalam Municipality
    const [[kothLb]] = await db.query("SELECT id FROM local_bodies WHERE name = 'Kothamangalam Municipality' LIMIT 1");
    const kothLbId = kothLb ? kothLb.id : 1;

    const [updateRes] = await db.query(`
      UPDATE geo_locations 
      SET local_body_id = ? 
      WHERE local_body_id IS NULL 
        AND (landmark = 'Kothamangalam' OR name LIKE '%Kothamangalam%' OR full_address LIKE '%Kothamangalam%')
    `, [kothLbId]);

    console.log(`✅ Updated ${updateRes.affectedRows} locations to Local Body ID ${kothLbId} (Kothamangalam Municipality)`);

    // 3. Summary
    const [summary] = await db.query(`
      SELECT 
        COALESCE(lb.name, 'Unassigned (NULL)') AS local_body,
        COUNT(*) AS total_locations
      FROM geo_locations g
      LEFT JOIN local_bodies lb ON g.local_body_id = lb.id
      GROUP BY g.local_body_id, lb.name
    `);
    console.log('\n📊 Locations breakdown by Local Body:');
    console.table(summary);

    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

runMigration();
