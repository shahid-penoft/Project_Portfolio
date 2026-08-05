import 'dotenv/config';
import db from './configs/db.js';

const renameRefNos = async () => {
    try {
        const [result] = await db.query(
            `UPDATE mla_care_applications SET ref_no = CONCAT('MC-', LPAD(id, 3, '0'))`
        );
        console.log(`[migrate_mla_care_refno] Updated ref_no for ${result.affectedRows} row(s).`);

        const [rows] = await db.query(
            `SELECT id, ref_no FROM mla_care_applications ORDER BY id`
        );
        console.log('Current ref numbers:');
        rows.forEach((r) => console.log(`  id=${r.id} -> ${r.ref_no}`));
    } catch (err) {
        console.error('[migrate_mla_care_refno] error:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
};

renameRefNos();
