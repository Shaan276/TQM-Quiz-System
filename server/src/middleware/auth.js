const jwt = require('jsonwebtoken');
const config = require('../config');

function normalizeRole(role) {
  if (!role) return 'STUDENT';
  const r = role.toUpperCase();
  if (r === 'LEARNER') return 'STUDENT';
  if (r === 'CREATOR') return 'TEACHER';
  if (r === 'ADMIN') return 'SUPER_ADMIN';
  return r;
}

function signAccessToken(payload) {
  const normalized = {
    ...payload,
    role: payload.role ? normalizeRole(payload.role) : 'STUDENT'
  };
  return jwt.sign(normalized, config.jwt.accessSecret, {
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
  if (req.user && req.user.role) {
    req.user.normalizedRole = normalizeRole(req.user.role);
  }
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

    const userRole = (req.user.role || '').toUpperCase();
    const userNormalized = normalizeRole(userRole);

    // SUPER_ADMIN (or ADMIN) has universal access
    if (userNormalized === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      return next();
    }

    const normalizedAllowed = allowedRoles.map(r => normalizeRole(r));
    const rawAllowed = allowedRoles.map(r => r.toUpperCase());

    const isAuthorized = normalizedAllowed.includes(userNormalized) || 
                         rawAllowed.includes(userRole) || 
                         normalizedAllowed.includes(userRole);

    if (!isAuthorized) {
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
  normalizeRole,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  authenticateToken,
  requireRole
};
