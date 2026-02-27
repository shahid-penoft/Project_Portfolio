import db from '../configs/db.js';
async function run() {
    console.log('Adding rich_content to media_posts...');
    try {
        await db.query(`ALTER TABLE media_posts ADD COLUMN rich_content LONGTEXT NULL AFTER content`);
        console.log('✅ rich_content added');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('⏭️  rich_content already exists');
        else throw e;
    }
    console.log('🎉 Done!');
    process.exit(0);
}
run().catch(err => { console.error('❌', err.message); process.exit(1); });
