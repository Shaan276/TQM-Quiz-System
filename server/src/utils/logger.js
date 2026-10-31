const config = require('../config');

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordconfirmation',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt_access_secret',
  'jwt_refresh_secret',
  'secret',
  'authorization',
  'cookie',
  'smtp_pass'
]);

function redactObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = redactObject(value, depth + 1);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

class StructuredLogger {
  constructor() {
    this.isProd = config.isProd;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = redactObject(meta);

    if (this.isProd) {
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message,
        ...sanitizedMeta
      });
    }

    const metaStr = Object.keys(sanitizedMeta).length > 0 ? ` ${JSON.stringify(sanitizedMeta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  info(message, meta = {}) {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message, meta = {}) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message, meta = {}) {
    console.error(this.formatMessage('error', message, meta));
  }

  debug(message, meta = {}) {
    if (!this.isProd) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }
}

const logger = new StructuredLogger();

module.exports = {
  logger,
  redactObject
};
