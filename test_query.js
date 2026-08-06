import pool from './configs/db.js';

const run = async () => {
    try {
        const [res] = await pool.query(`SELECT id, name, type FROM local_bodies WHERE (type IS NULL OR type NOT IN ('BLOCK_PANCHAYAT', 'DISTRICT_PANCHAYAT'))`);
        console.log("Filtered result:", res);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
