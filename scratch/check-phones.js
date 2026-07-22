import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const [rows] = await pool.query("SELECT id, name, phone, office_phone, alternative_phone, officer_phone, whatsapp_number FROM governing_representatives WHERE governing_body_type='OTHER' LIMIT 10");
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
run();
