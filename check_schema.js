require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mlaconnect',
  });

  const [rows] = await connection.execute('DESCRIBE issues');
  console.log(rows.filter(r => r.Field === 'category'));
  await connection.end();
}
run().catch(console.error);
