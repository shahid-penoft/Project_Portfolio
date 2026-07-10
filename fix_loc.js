import db from './configs/db.js';

const run = async () => {
    try {
        const val = JSON.stringify("Cherukara - Muthukurussi, ചെറുകര, Perinthalmanna, മലപ്പുറം ജില്ല, Kerala, 679340, India");
        await db.query('UPDATE governing_representatives SET office_location = ? WHERE id = 5', [val]);
        console.log('Fixed DB successfully');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
};

run();
