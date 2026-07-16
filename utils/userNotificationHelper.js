/**
 * userNotificationHelper.js
 * Fire-and-forget helpers for constituent-facing (user) notifications.
 * Call these from module controllers after status changes, new updates, etc.
 * Errors are non-fatal — they log but never crash the main request.
 */
import pool from '../configs/db.js';

/**
 * Send a notification to a specific constituent user.
 * @param {number} userId   - constituent_users.id
 * @param {object} payload
 *   @param {string} payload.title
 *   @param {string} [payload.message]
 *   @param {string} [payload.type]      e.g. 'info','alert','success'
 *   @param {string} [payload.module]    e.g. 'Complaints','Issues'
 *   @param {string} [payload.record_ref] e.g. 'CMP-2024-001'
 *   @param {string} [payload.link_path] e.g. '/mla-connect/submissions/3'
 */
export const notifyUser = async (userId, payload) => {
  if (!userId || !payload?.title) return;
  try {
    await pool.query(
      `INSERT INTO user_notifications
         (target_user_id, title, message, type, module, record_ref, link_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        payload.title,
        payload.message  || null,
        payload.type     || 'info',
        payload.module   || null,
        payload.record_ref || null,
        payload.link_path  || null,
      ]
    );
  } catch (err) {
    console.error('[userNotificationHelper] notifyUser error:', err.message);
  }
};
