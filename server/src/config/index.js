const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isDev = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

function validateConfig(customEnv = null) {
  const env = customEnv || process.env;
  const currentEnv = env.NODE_ENV || 'development';
  const errors = [];

  const accessSecret = env.JWT_ACCESS_SECRET || '';
  const refreshSecret = env.JWT_REFRESH_SECRET || '';

  if (currentEnv === 'production') {
    if (!accessSecret) {
      errors.push('JWT_ACCESS_SECRET is required in production.');
    } else if (accessSecret.length < 32) {
      errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production.');
    } else if (accessSecret.includes('fallback') || accessSecret.includes('dev_secret')) {
      errors.push('JWT_ACCESS_SECRET cannot use insecure development fallback in production.');
    }

    if (!refreshSecret) {
      errors.push('JWT_REFRESH_SECRET is required in production.');
    } else if (refreshSecret.length < 32) {
      errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production.');
    } else if (refreshSecret.includes('fallback') || refreshSecret.includes('dev_secret')) {
      errors.push('JWT_REFRESH_SECRET cannot use insecure development fallback in production.');
    }

    if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
      errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct keys.');
    }

    if (env.CORS_ORIGIN === '*') {
      errors.push('CORS_ORIGIN cannot be wildcard (*) in production with credentials.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv,
  isDev,
  isProd,
  isTest,
  
  db: {
    type: process.env.DATABASE_TYPE || 'sqlite',
    path: path.resolve(__dirname, '../../', process.env.DATABASE_PATH || './data/quiz_system.db')
  },
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_dev_access_secret_32_characters_long',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_dev_refresh_secret_32_characters_long',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : ['http://localhost:3000']
  },
  
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 2525,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'no-reply@quizsystem.io'
  },

  validateConfig,

  // Sanitized view of config for diagnostic logging (never exposes secrets)
  getSanitizedConfig() {
    return {
      port: this.port,
      nodeEnv: this.nodeEnv,
      db: {
        type: this.db.type,
        path: path.basename(this.db.path)
      },
      jwt: {
        accessExpiresIn: this.jwt.accessExpiresIn,
        refreshExpiresIn: this.jwt.refreshExpiresIn,
        configured: Boolean(process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET)
      },
      cors: {
        origins: this.cors.origin
      },
      smtp: {
        host: this.smtp.host || 'none',
        from: this.smtp.from
      }
    };
  }
};

module.exports = config;
