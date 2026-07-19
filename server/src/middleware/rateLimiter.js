// Minimal in-memory sliding-window rate limiter. Good enough for a single-
// instance demo deployment; swap for a shared store (Redis) behind a load
// balancer in production.

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
