import db from './configs/db.js';

async function run() {
    try {
        const tables = ['complaints', 'issues', 'cm_fund_requests', 'mla_letters', 'governing_representatives'];
        for (const t of tables) {
            console.log(`\n--- TABLE: ${t} ---`);
            const [rows] = await db.query(`DESCRIBE ${t}`);
            const cols = rows.map(r => r.Field).join(', ');
            console.log(cols);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
