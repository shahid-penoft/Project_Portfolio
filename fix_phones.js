import db from './configs/db.js';

const [result] = await db.query(
  "UPDATE constituent_users SET phone = SUBSTRING(phone, 3) WHERE phone LIKE '91%' AND LENGTH(phone) = 12"
);
console.log('Rows updated:', result.affectedRows);

// Show current phones for verification
const [users] = await db.query('SELECT id, full_name, phone FROM constituent_users');
console.log('Current users:', users);

process.exit(0);
