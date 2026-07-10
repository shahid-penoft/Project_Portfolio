import db from './configs/db.js';

try {
    await db.query('TRUNCATE TABLE admin_activity_logs');
    console.log('✅ admin_activity_logs cleared — all rows deleted.');
} catch (err) {
    console.error('❌ Failed to clear logs:', err.message);
} finally {
    process.exit(0);
}
