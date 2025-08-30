import { Middleware } from "../router/types";

interface Bucket {
  tokens: number;
  lastRefill: number; // ms epoch
}

const ipBuckets = new Map<string, Bucket>();

function getBucket(key: string, capacity: number): Bucket {
  const now = Date.now();
  const existing = ipBuckets.get(key);
  if (existing) {
    return existing;
  }
  const b: Bucket = { tokens: capacity, lastRefill: now };
  ipBuckets.set(key, b);
  return b;
}

/**
 * Simple token-bucket rate limiter per IP.
 * Config via env:
 * - RATE_LIMIT_WINDOW_MS: window duration for refill (default 1000ms)
 * - RATE_LIMIT_MAX: max tokens per window (default 50)
 */
export const rateLimitMiddleware: Middleware = async (ctx, _next) => {
  if (ctx.req.method === "OPTIONS") return _next();

  const windowMs = Math.max(100, Number(process.env.RATE_LIMIT_WINDOW_MS ?? 1000));
  const max = Math.max(1, Number(process.env.RATE_LIMIT_MAX ?? 50));
  const ip = ctx.req.socket.remoteAddress || "unknown";

  const now = Date.now();
  const bucket = getBucket(ip, max);
  // Refill tokens
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= windowMs) {
    const windows = Math.floor(elapsed / windowMs);
    bucket.tokens = Math.min(max, bucket.tokens + windows * max);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    ctx.res.setHeader("Retry-After", Math.ceil(windowMs / 1000).toString());
    ctx.res.writeHead(429, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Too many requests", requestId: ctx.requestId }));
    return;
  }

  bucket.tokens -= 1;
  return _next();
};
