const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  
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
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },
  
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 2525,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'no-reply@quizsystem.io'
  }
};

module.exports = config;
