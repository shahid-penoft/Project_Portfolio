import db from './configs/db.js';

async function run() {
    try {
        await db.query('ALTER TABLE governing_body_staffs ADD COLUMN remarks TEXT');
        console.log('Successfully added remarks column to governing_body_staffs');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column remarks already exists.');
            process.exit(0);
        }
        console.error(err);
        process.exit(1);
    }
}
run();
