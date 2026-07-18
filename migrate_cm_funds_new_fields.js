import pool from './configs/db.js';

const queries = [
  `ALTER TABLE cm_fund_requests 
   ADD COLUMN application_title VARCHAR(255) AFTER id,
   ADD COLUMN pan_card_number VARCHAR(20) AFTER ration_card_number,
   ADD COLUMN address TEXT AFTER address_line2,
   ADD COLUMN location TEXT AFTER address,
   ADD COLUMN latitude DECIMAL(10, 8) AFTER location,
   ADD COLUMN longitude DECIMAL(11, 8) AFTER latitude;`
];

async function run() {
  try {
    for (const q of queries) {
      await pool.query(q);
      console.log('Executed query successfully.');
    }
    console.log('Migration for new CM Funds fields executed!');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    process.exit();
  }
}

run();
