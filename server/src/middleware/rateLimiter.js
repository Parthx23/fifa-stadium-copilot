/**
 * @fileoverview Sliding-window rate limiter middleware.
 * Tracks requests per IP using an in-memory Map with timestamp arrays.
 * Suitable for single-instance deployments; swap for Redis-backed
 * rate limiting behind a load balancer in production.
 * @module middleware/rateLimiter
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

const hits = new Map(); // ip -> [timestamps]

export function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (hits.get(ip) || []).filter((t) => t > windowStart);
  timestamps.push(now);
  hits.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    return;
  }
  next();
}
