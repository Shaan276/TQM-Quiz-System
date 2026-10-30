// In-memory sliding-window rate limiter for brute-force prevention
const rateLimitMap = new Map();

function rateLimiter({ windowMs = 60 * 1000, maxRequests = 10, message = 'Too many requests. Please try again later.' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown-ip';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    const clientData = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }

    clientData.count++;
    rateLimitMap.set(key, clientData);

    if (clientData.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'ERR_RATE_LIMIT_EXCEEDED',
          message,
          retryAfterMs: Math.max(0, clientData.resetTime - now)
        }
      });
    }

    next();
  };
}

module.exports = {
  rateLimiter
};
