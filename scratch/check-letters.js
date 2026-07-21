import db from '../configs/db.js';

async function check() {
    const [letters] = await db.query("SELECT id, subject, status, trashed_at FROM mla_letters");
    console.log("Letters:", letters);
    process.exit(0);
}

check();
