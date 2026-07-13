import pool from './configs/db.js';

async function run() {
  try {
    console.log('Adding application_type to cm_fund_requests...');
    await pool.query(`
      ALTER TABLE cm_fund_requests 
      ADD COLUMN application_type ENUM('CMDRF', 'General') DEFAULT 'CMDRF' AFTER pincode;
    `);
    console.log('Successfully added application_type.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column application_type already exists. Skipping.');
    } else {
      console.error('Error adding application_type:', err);
    }
  } finally {
    process.exit();
  }
}

run();
