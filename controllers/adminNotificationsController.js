import pool from '../configs/db.js';

// ─────────────────────────────────────────────────────────────
// GET /api/notifications/admin
// Returns paginated notifications for the logged-in admin
// ─────────────────────────────────────────────────────────────
export const getAdminNotifications = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

    const limit  = Math.min(parseInt(req.query.limit)  || 30, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);

    const [rows] = await pool.query(
      `SELECT id, title, message, type, module, record_id, record_ref, link_path,
              is_read, read_at, created_at
       FROM admin_notifications
       WHERE target_admin_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [adminId, limit, offset]
    );

    const [[{ unread_count }]] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM admin_notifications WHERE target_admin_id = ? AND is_read = 0',
      [adminId]
    );

    res.json({ success: true, data: rows, unread_count: Number(unread_count) });
  } catch (err) {
    console.error('[getAdminNotifications]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/notifications/admin/:id/read
// Mark a single notification as read (only the owner can do this)
// ─────────────────────────────────────────────────────────────
export const markOneAsRead = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

    const { id } = req.params;
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid notification id.' });

    const [result] = await pool.query(
      `UPDATE admin_notifications
       SET is_read = 1, read_at = NOW()
       WHERE id = ? AND target_admin_id = ? AND is_read = 0`,
      [id, adminId]
    );

    res.json({ success: true, updated: result.affectedRows > 0 });
  } catch (err) {
    console.error('[markOneAsRead]', err);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/notifications/admin/mark-all-read
// Mark all unread notifications for the logged-in admin as read
// ─────────────────────────────────────────────────────────────
export const markAllAsRead = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized.' });

    const [result] = await pool.query(
      `UPDATE admin_notifications
       SET is_read = 1, read_at = NOW()
       WHERE target_admin_id = ? AND is_read = 0`,
      [adminId]
    );

    res.json({ success: true, updated_count: result.affectedRows });
  } catch (err) {
    console.error('[markAllAsRead]', err);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read.' });
  }
};
