import pool from './configs/db.js';

const patch = async () => {
  try {
    console.log('[SchemesMigration] Checking for columns created_by_name / updated_by_name in welfare_schemes…');

    const [cols] = await pool.query('DESCRIBE welfare_schemes');
    const existingCols = cols.map(c => c.Field);

    if (!existingCols.includes('created_by_name')) {
      console.log('[SchemesMigration] Adding column created_by_name…');
      await pool.query(
        `ALTER TABLE welfare_schemes ADD COLUMN created_by_name VARCHAR(150) DEFAULT 'Rajesh Kumar (ADM-001)'`
      );
    }

    if (!existingCols.includes('updated_by_name')) {
      console.log('[SchemesMigration] Adding column updated_by_name…');
      await pool.query(
        `ALTER TABLE welfare_schemes ADD COLUMN updated_by_name VARCHAR(150) DEFAULT 'Rajesh Kumar (ADM-001)'`
      );
    }

    // Populate null values if any
    await pool.query(
      `UPDATE welfare_schemes SET created_by_name = 'Rajesh Kumar (ADM-001)' WHERE created_by_name IS NULL`
    );
    await pool.query(
      `UPDATE welfare_schemes SET updated_by_name = 'Rajesh Kumar (ADM-001)' WHERE updated_by_name IS NULL`
    );

    console.log('[SchemesMigration] ✅ welfare_schemes columns created_by_name and updated_by_name patched successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[SchemesMigration] ❌ Migration failed:', err);
    process.exit(1);
  }
};

patch();
