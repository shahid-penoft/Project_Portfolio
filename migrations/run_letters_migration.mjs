import pool from '../configs/db.js';
import { readFileSync } from 'fs';

const sql = readFileSync('./migrations/letters_migration.sql', 'utf8');
// Split on semicolons, skip comment-only lines and empty statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

let ok = 0, failed = 0;
for (const stmt of statements) {
  try {
    await pool.query(stmt);
    console.log('✅', stmt.slice(0, 70).replace(/\s+/g, ' '));
    ok++;
  } catch (e) {
    if (e.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⏭️  Table already exists, skipping.');
      ok++;
    } else {
      console.error('❌', e.message, '\n   ', stmt.slice(0, 70));
      failed++;
    }
  }
}

console.log(`\nDone. ${ok} succeeded, ${failed} failed.`);
pool.end();
