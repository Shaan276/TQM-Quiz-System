const express = require('express');
const { dbGet, dbAll, dbRun } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// -------------------------------------------------------------
// GET /api/v1/notifications - List user's notifications
// -------------------------------------------------------------
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 30 } = req.query;

    const notifications = await dbAll(
      `SELECT id, user_id, title, message, type, link_url, is_read, created_at 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, parseInt(limit) || 30]
    );

    const unreadRow = await dbGet(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: unreadRow?.unread_count || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// PATCH or PUT /api/v1/notifications/:id/read - Mark single as read
// -------------------------------------------------------------
router.patch('/:id/read', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await dbGet(`SELECT id FROM notifications WHERE id = ? AND user_id = ?`, [id, userId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: 'Notification not found' } });
    }

    await dbRun(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);

    const unreadRow = await dbGet(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        id,
        is_read: 1,
        unreadCount: unreadRow?.unread_count || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/read', authenticateToken, async (req, res, next) => {
  req.method = 'PATCH';
  router.handle(req, res, next);
});

// -------------------------------------------------------------
// POST /api/v1/notifications/read-all - Mark all as read
// -------------------------------------------------------------
router.post('/read-all', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await dbRun(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, [userId]);

    res.json({
      success: true,
      data: { message: 'All notifications marked as read', unreadCount: 0 }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// DELETE /api/v1/notifications/:id - Delete single notification
// -------------------------------------------------------------
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await dbRun(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [id, userId]);

    const unreadRow = await dbGet(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    res.json({
      success: true,
      data: { message: 'Notification deleted', unreadCount: unreadRow?.unread_count || 0 }
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// POST /api/v1/notifications/report-error - Report page error to admins (Aggregated)
// -------------------------------------------------------------
const errorReportTracker = new Map();

router.post('/report-error', async (req, res, next) => {
  try {
    const { route = 'unknown', errorMessage = 'Rendering error', errorStack } = req.body || {};
    const reporter = req.headers.authorization ? 'Authenticated User' : 'Visitor/Student';
    
    const cleanRoute = String(route).replace(/[^a-zA-Z0-9_-]/g, '').trim() || 'unknown';
    const cleanMsg = String(errorMessage).slice(0, 200).trim();
    const aggregateKey = `${cleanRoute}::${cleanMsg}`;
    
    const count = (errorReportTracker.get(aggregateKey) || 0) + 1;
    errorReportTracker.set(aggregateKey, count);

    // Fetch all platform & institutional admins
    const admins = await dbAll(`SELECT id FROM users WHERE role IN ('SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN')`);
    
    if (admins.length > 0) {
      const crypto = require('crypto');
      const title = `⚠️ Page Error: #${cleanRoute}`;
      const msg = `"${cleanMsg}" encountered on #${cleanRoute}. (Reported ${count} time${count > 1 ? 's' : ''} by users)`;
      const linkUrl = `/#${cleanRoute}`;

      for (const admin of admins) {
        // Check for existing unread error notification for this route
        const existing = await dbGet(
          `SELECT id FROM notifications WHERE user_id = ? AND title = ? AND is_read = 0`,
          [admin.id, title]
        );

        if (existing) {
          // Update the existing notification message with incremented count (avoids spamming admins)
          await dbRun(
            `UPDATE notifications SET message = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [msg, existing.id]
          );
        } else {
          // Insert a fresh notification
          await dbRun(
            `INSERT INTO notifications (id, user_id, title, message, type, link_url, is_read) VALUES (?, ?, ?, ?, 'ACTION_REQUIRED', ?, 0)`,
            [crypto.randomUUID(), admin.id, title, msg, linkUrl]
          );
        }
      }
    }

    return res.json({
      success: true,
      data: {
        count,
        message: 'Error reported to admin successfully. Thank you for reporting this issue.'
      }
    });
  } catch (err) {
    console.error('[ErrorReport] Failed to record error report:', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to process error report' } });
  }
});

// -------------------------------------------------------------
// DELETE /api/v1/notifications - Clear all read notifications
// -------------------------------------------------------------
router.delete('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await dbRun(`DELETE FROM notifications WHERE user_id = ? AND is_read = 1`, [userId]);

    res.json({
      success: true,
      data: { message: 'Cleared read notifications' }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
