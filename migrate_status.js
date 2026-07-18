import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '../Backend/.env' });

async function run() {
  const pool = mysql.createPool(process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mla_connect',
  });
  
  try {
    await pool.query("ALTER TABLE cm_fund_requests MODIFY COLUMN status VARCHAR(150) DEFAULT 'Submitted'");
    console.log('Successfully altered cm_fund_requests status column.');
    
    const statuses = [
      { label: 'Draft',            color: 'gray' },
      { label: 'Submitted',        color: 'blue' },
      { label: 'Under Review',     color: 'purple' },
      { label: 'Document Pending', color: 'orange' },
      { label: 'Approved',         color: 'green' },
      { label: 'Rejected',         color: 'red' },
      { label: 'Disbursed',        color: 'blue' }
    ];
    
    const [rows] = await pool.query('SELECT id FROM mla_dropdown_lists WHERE `key` = ?', ['cmfund_status']);
    if (rows.length === 0) {
      for (let i = 0; i < statuses.length; i++) {
        const s = statuses[i];
        await pool.query(
          'INSERT INTO mla_dropdown_lists (`key`, module, label, value, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
          ['cmfund_status', 'CM Funds', s.label, s.label, s.color, i]
        );
      }
      console.log('Successfully seeded cmfund_status dropdown options.');
    } else {
      console.log('cmfund_status already exists in dropdown manager.');
    }
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    process.exit(0);
  }
}
run();
