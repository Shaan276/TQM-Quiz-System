const crypto = require('crypto');

/**
 * Request Correlation ID Middleware
 * Assigns a unique UUID to every incoming HTTP request and returns it in response headers.
 */
function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];
  const requestId = existingId && typeof existingId === 'string' && existingId.length < 128
    ? existingId
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = { requestIdMiddleware };
