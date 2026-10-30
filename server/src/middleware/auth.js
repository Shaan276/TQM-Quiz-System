const jwt = require('jsonwebtoken');
const config = require('../config');

function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
}

function verifyAccessToken(token) {
  try {
    return { valid: true, decoded: jwt.verify(token, config.jwt.accessSecret) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function verifyRefreshToken(token) {
  try {
    return { valid: true, decoded: jwt.verify(token, config.jwt.refreshSecret) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'ERR_UNAUTHORIZED',
        message: 'Authentication token required'
      }
    });
  }

  const result = verifyAccessToken(token);
  if (!result.valid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'ERR_TOKEN_EXPIRED_OR_INVALID',
        message: 'Invalid or expired session token'
      }
    });
  }

  req.user = result.decoded;
  next();
}

// Role-Based Authorization Guard Middleware
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'ERR_UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ERR_FORBIDDEN',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
        }
      });
    }

    next();
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  authenticateToken,
  requireRole
};
