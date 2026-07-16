import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  
  const tables = ['complaints', 'issues', 'ideas', 'suggestions'];
  for (const table of tables) {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN address TEXT AFTER location`);
      console.log(`Successfully added address column to ${table}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`Column address already exists on ${table}`);
      } else {
        console.log(`Error on ${table}:`, e.message);
      }
    }
  }
  
  await connection.end();
}

run();
