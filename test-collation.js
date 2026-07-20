import db from './configs/db.js';
async function test() {
    try {
        const [rows] = await db.query(`SELECT @@character_set_connection, @@collation_connection, @@character_set_database, @@collation_database`);
        console.log(rows);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
test();
