import pool from '../configs/db.js';

/**
 * Insert a single notification for a specific admin user.
 * Non-fatal — errors are logged but not thrown, so they never break the parent request.
 *
 * @param {number} targetAdminId  - The admin_users.id of the recipient
 * @param {{ title, message, type, module, record_id, record_ref, link_path }} payload
 */
export const createNotification = async (targetAdminId, {
  title,
  message,
  type = 'info',
  module = null,
  record_id = null,
  record_ref = null,
  link_path = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO admin_notifications
        (target_admin_id, title, message, type, module, record_id, record_ref, link_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetAdminId, title, message, type, module, record_id, record_ref, link_path]
    );
  } catch (err) {
    console.warn('[createNotification] Non-fatal insert failure:', err.message);
  }
};

/**
 * Broadcast a notification to ALL active admin users.
 * Non-fatal — errors per-admin are silently skipped.
 *
 * @param {{ title, message, type, module, record_id, record_ref, link_path }} payload
 */
export const broadcastNotification = async ({
  title,
  message,
  type = 'info',
  module = null,
  record_id = null,
  record_ref = null,
  link_path = null,
}) => {
  try {
    const [admins] = await pool.query('SELECT id FROM admin_users WHERE is_active = 1');
    await Promise.all(
      admins.map(a =>
        createNotification(a.id, { title, message, type, module, record_id, record_ref, link_path })
      )
    );
  } catch (err) {
    console.warn('[broadcastNotification] Failed to fetch admins:', err.message);
  }
};
