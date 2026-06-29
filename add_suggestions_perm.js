import pool from './configs/db.js';

async function run() {
  try {
    const [roles] = await pool.query('SELECT id, permissions FROM admin_roles WHERE name IN ("Superadmin", "Admin")');
    for (const role of roles) {
      let perms = role.permissions || [];
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch (e) { perms = []; }
      }
      if (!Array.isArray(perms)) perms = [];
      if (!perms.includes('suggestions')) {
        perms.push('suggestions');
        await pool.query('UPDATE admin_roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
        console.log(`Added suggestions permission to role ${role.id}`);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
