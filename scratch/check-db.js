import db from '../configs/db.js';

async function check() {
    const [rows] = await db.query('SELECT * FROM password_resets ORDER BY created_at DESC LIMIT 5');
    console.log("Recent password_resets:");
    console.log(rows);
    process.exit(0);
}
check();
