const crypto = require('crypto');
const { dbRun, dbGet } = require('../database');
const { logger } = require('../utils/logger');

/**
 * Record an administrative or sensitive platform audit event
 */
async function recordAuditEvent({
  action,
  actorId = null,
  actorRole = null,
  targetId = null,
  targetType = null,
  ipAddress = null,
  userAgent = null,
  details = {}
}) {
  const auditMetadata = {
    ...details,
    actorId,
    actorRole,
    targetId,
    targetType,
    userAgent
  };

  try {
    let validUserId = null;
    if (actorId) {
      const userExists = await dbGet('SELECT id FROM users WHERE id = ?', [actorId]);
      if (userExists) {
        validUserId = actorId;
      }
    }

    await dbRun(`
      INSERT INTO audit_logs (user_id, action, details, ip_address)
      VALUES (?, ?, ?, ?)
    `, [
      validUserId,
      action,
      JSON.stringify(auditMetadata),
      ipAddress
    ]);
  } catch (err) {
    // Non-blocking fallback
    logger.warn('Failed to insert audit log to database', { error: err.message, action });
  }

  logger.info(`[AUDIT] ${action}`, {
    action,
    actorId,
    actorRole,
    targetId,
    targetType,
    ipAddress
  });
}

module.exports = { recordAuditEvent };
