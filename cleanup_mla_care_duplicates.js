import 'dotenv/config';
import db from './configs/db.js';

const DELETE_IDS = [3, 5];

const cleanupDuplicates = async () => {
    try {
        const placeholders = DELETE_IDS.map(() => '?').join(', ');
        const [before] = await db.query('SELECT COUNT(*) AS total FROM mla_care_applications');
        console.log(`[cleanup] Rows before: ${before[0].total}`);

        for (const id of DELETE_IDS) {
            const [row] = await db.query('SELECT id, ref_no, patient_name FROM mla_care_applications WHERE id = ?', [id]);
            if (row.length) {
                await db.query('DELETE FROM mla_care_applications WHERE id = ?', [id]);
                console.log(`[cleanup] Deleted id=${id} (${row[0].ref_no}, ${row[0].patient_name})`);
            } else {
                console.log(`[cleanup] id=${id} already absent, skipping`);
            }
        }

        const [after] = await db.query('SELECT COUNT(*) AS total FROM mla_care_applications');
        console.log(`[cleanup] Rows after: ${after[0].total}`);
    } catch (err) {
        console.error('[cleanup] error:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
};

cleanupDuplicates();
