/**
 * userNotificationsController.js
 * Handles in-app notification CRUD for constituent users.
 * All endpoints require verifyConstituentToken middleware.
 */
import pool from '../configs/db.js';

// ── GET /api/notifications/user ────────────────────────────────
// Returns paginated notifications for the logged-in constituent
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.constituent?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

    const limit  = Math.min(60, parseInt(req.query.limit)  || 40);
    const offset = Math.max(0,  parseInt(req.query.offset) || 0);

    const [data] = await pool.query(
      `SELECT * FROM user_notifications
       WHERE target_user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [[{ unread_count }]] = await pool.query(
      `SELECT COUNT(*) AS unread_count
       FROM user_notifications
       WHERE target_user_id = ? AND is_read = 0`,
      [userId]
    );

    res.json({ success: true, data, unread_count: Number(unread_count) });
  } catch (err) {
    console.error('[getUserNotifications]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// ── PATCH /api/notifications/user/mark-all-read ────────────────
export const markAllUserNotificationsRead = async (req, res) => {
  try {
    const userId = req.constituent?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

    await pool.query(
      `UPDATE user_notifications SET is_read = 1
       WHERE target_user_id = ? AND is_read = 0`,
      [userId]
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('[markAllUserNotificationsRead]', err);
    res.status(500).json({ success: false, message: 'Failed to mark notifications.' });
  }
};

// ── PATCH /api/notifications/user/:id/read ─────────────────────
export const markOneUserNotificationRead = async (req, res) => {
  try {
    const userId = req.constituent?.id;
    const notifId = parseInt(req.params.id);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized.' });
    if (!notifId) return res.status(400).json({ success: false, message: 'Invalid id.' });

    await pool.query(
      `UPDATE user_notifications SET is_read = 1
       WHERE id = ? AND target_user_id = ?`,
      [notifId, userId]
    );
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('[markOneUserNotificationRead]', err);
    res.status(500).json({ success: false, message: 'Failed to mark notification.' });
  }
};
