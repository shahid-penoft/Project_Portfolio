import db from '../configs/db.js';

async function check() {
    try {
        const [rows] = await db.query('DESCRIBE complaints');
        console.log(rows.map(r => r.Field));
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
check();
