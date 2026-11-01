const crypto = require('crypto');
const { dbRun, dbAll, dbGet } = require('../database');

/**
 * Persists an in-app notification for a user.
 */
async function createNotification({ userId, title, message, type = 'INFO', linkUrl = null }) {
  if (!userId || !title || !message) return null;
  const id = crypto.randomUUID();
  try {
    await dbRun(
      `INSERT INTO notifications (id, user_id, title, message, type, link_url, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, userId, title, message, type, linkUrl]
    );
    return { id, userId, title, message, type, linkUrl, isRead: false, createdAt: new Date().toISOString() };
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err);
    return null;
  }
}

/**
 * Broadcasts a notification to multiple users.
 */
async function notifyUsers(userIds, { title, message, type = 'INFO', linkUrl = null }) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const promises = uniqueIds.map(uid => createNotification({ userId: uid, title, message, type, linkUrl }));
  return Promise.all(promises);
}

module.exports = {
  createNotification,
  notifyUsers
};
