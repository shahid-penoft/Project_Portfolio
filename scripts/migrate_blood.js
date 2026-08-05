import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Connected to DB:', process.env.DB_NAME);

  // ── Step 1: Add missing columns to blood_donors ──────────────────────────
  const [cols] = await conn.query('SHOW COLUMNS FROM blood_donors');
  const colNames = cols.map((c) => c.Field);
  console.log('blood_donors existing columns:', colNames.join(', '));

  if (!colNames.includes('gender')) {
    await conn.query("ALTER TABLE blood_donors ADD COLUMN gender VARCHAR(10) DEFAULT 'Male' AFTER name");
    console.log('✅ Added: gender');
  } else {
    console.log('⏩ Skipped: gender (already exists)');
  }

  if (!colNames.includes('age')) {
    await conn.query('ALTER TABLE blood_donors ADD COLUMN age TINYINT UNSIGNED NULL AFTER gender');
    console.log('✅ Added: age');
  } else {
    console.log('⏩ Skipped: age (already exists)');
  }

  if (!colNames.includes('house_name')) {
    await conn.query('ALTER TABLE blood_donors ADD COLUMN house_name VARCHAR(200) NULL AFTER panchayat');
    console.log('✅ Added: house_name');
  } else {
    console.log('⏩ Skipped: house_name (already exists)');
  }

  if (!colNames.includes('display_in_directory')) {
    await conn.query(
      'ALTER TABLE blood_donors ADD COLUMN display_in_directory TINYINT(1) NOT NULL DEFAULT 1 AFTER is_verified'
    );
    console.log('✅ Added: display_in_directory');
  } else {
    console.log('⏩ Skipped: display_in_directory (already exists)');
  }

  // ── Step 2: Create blood_requests table ───────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS blood_requests (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      patient_name     VARCHAR(100)  NOT NULL,
      blood_group      ENUM('O+','O-','A+','A-','B+','B-','AB+','AB-') NOT NULL DEFAULT 'O+',
      units_needed     VARCHAR(10)   NOT NULL DEFAULT '2',
      hospital_name    VARCHAR(200)  NOT NULL,
      house_name       VARCHAR(200)  NOT NULL,
      local_body_id    INT UNSIGNED  NULL,
      ward_id          INT UNSIGNED  NULL,
      ward_info        VARCHAR(150)  NULL,
      contact_person   VARCHAR(100)  NULL,
      contact_phone    VARCHAR(20)   NOT NULL,
      required_date    DATE          NOT NULL,
      status           ENUM('Pending','Active','Fulfilled') NOT NULL DEFAULT 'Pending',
      notes            TEXT          NULL,
      is_active        TINYINT(1)    NOT NULL DEFAULT 1,
      created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ blood_requests table created (or already existed)');

  await conn.end();
  console.log('\n🎉 Migration complete!');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
