import db from './configs/db.js';

async function update() {
    try {
        const [users] = await db.query('SELECT id FROM admin_users LIMIT 1');
        if (users.length > 0) {
            const uid = users[0].id;
            await db.query(`UPDATE projects SET created_by = ?, updated_by = ?`, [uid, uid]);
            console.log(`Updated all projects authors to user ID ${uid}`);
        } else {
            console.log("No admin users found in DB.");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
update();
