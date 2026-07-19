const mysql = require('mysql2/promise');
async function run() {
  const pool = mysql.createPool({
    host: 'database-2.c3m4s46o28rm.ap-south-1.rds.amazonaws.com',
    user: 'penoftadmin',
    password: '8yf7VvA9QtKOwKLB94h7',
    database: 'test_portfolio_testdb_team_b12a'
  });

  const tables = ['issues', 'complaints', 'ideas', 'suggestions'];
  
  for (const table of tables) {
    try {
      console.log(`Modifying updated_by_admin_id for ${table}...`);
      await pool.query(`ALTER TABLE ${table} MODIFY COLUMN updated_by_admin_id INT UNSIGNED NULL DEFAULT NULL;`);
      await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT fk_${table}_updater FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;`);
      console.log(`Success for ${table}`);
    } catch (err) {
      console.error(`Error for ${table}:`, err.message);
    }
  }

  process.exit(0);
}
run();
