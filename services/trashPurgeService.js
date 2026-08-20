import cron from 'node-cron';
import pool from '../configs/db.js';

const THIRTY_DAYS_AGO = `NOW() - INTERVAL 30 DAY`;

const purgeTable = async (connection, label, sql) => {
  try {
    const [result] = await connection.query(sql);
    if (result.affectedRows > 0) {
      console.log(`[TrashPurge] Purged ${result.affectedRows} row(s) from ${label}.`);
    }
  } catch (err) {
    console.error(`[TrashPurge] Error purging ${label}:`, err.message);
  }
};

const runPurge = async () => {
  console.log('[TrashPurge] Running scheduled trash purge...');
  const connection = await pool.getConnection();
  try {
    await purgeTable(connection, 'complaints',
      `DELETE FROM complaints WHERE is_deleted = 1 AND deleted_at < ${THIRTY_DAYS_AGO}`);

    await purgeTable(connection, 'issues',
      `DELETE FROM issues WHERE is_deleted = 1 AND deleted_at < ${THIRTY_DAYS_AGO}`);

    await purgeTable(connection, 'governing_bodies',
      `DELETE FROM governing_bodies WHERE is_deleted = 1 AND deleted_at < ${THIRTY_DAYS_AGO}`);

    await purgeTable(connection, 'mla_letters',
      `DELETE FROM mla_letters WHERE status = 'Archived' AND trashed_at IS NOT NULL AND trashed_at < ${THIRTY_DAYS_AGO}`);

    await purgeTable(connection, 'cm_fund_requests',
      `DELETE FROM cm_fund_requests WHERE is_deleted = 1 AND deleted_at < ${THIRTY_DAYS_AGO}`);

    await purgeTable(connection, 'projects',
      `DELETE FROM projects WHERE is_deleted = 1 AND deleted_at < ${THIRTY_DAYS_AGO}`);

    console.log('[TrashPurge] Purge cycle complete.');
  } finally {
    connection.release();
  }
};

export const initTrashPurge = () => {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', runPurge, { timezone: 'Asia/Kolkata' });
  console.log('[TrashPurge] Cron job scheduled — daily at 02:00 IST.');
};
