import pool from './configs/db.js';

const run = async () => {
    try {
        const [res] = await pool.query(`SHOW CREATE TABLE projects`);
        console.log("Schema:", res[0]['Create Table']);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
