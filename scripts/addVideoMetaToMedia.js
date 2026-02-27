/**
 * scripts/addVideoMetaToMedia.js
 * Adds thumbnail_url and youtube_url columns to event_media table.
 */
import db from '../configs/db.js';

async function run() {
    console.log('🔧 Adding thumbnail_url and youtube_url to event_media...');
    try {
        await db.query(`ALTER TABLE event_media ADD COLUMN thumbnail_url VARCHAR(500) NULL AFTER file_url`);
        console.log('  ✅ thumbnail_url added');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('  ⏭️  thumbnail_url already exists');
        else throw e;
    }
    try {
        await db.query(`ALTER TABLE event_media ADD COLUMN youtube_url VARCHAR(500) NULL AFTER thumbnail_url`);
        console.log('  ✅ youtube_url added');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('  ⏭️  youtube_url already exists');
        else throw e;
    }
    console.log('🎉 Done!');
    process.exit(0);
}
run().catch(err => { console.error('❌', err.message); process.exit(1); });
