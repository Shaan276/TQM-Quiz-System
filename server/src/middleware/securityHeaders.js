const config = require('../config');

/**
 * Security Headers Middleware (Production Hardened)
 * Defends against MIME sniffing, clickjacking, XSS, and unauthorized embeds.
 */
function securityHeaders(req, res, next) {
  // Prevent browser MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent unauthorized framing (Clickjacking protection, allow same-origin)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy browser XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict sensitive browser APIs
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // HTTP Strict Transport Security (HSTS) in production
  if (config.isProd || req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self' data:; object-src 'none'; frame-ancestors 'self';"
  );

  next();
}

module.exports = { securityHeaders };
