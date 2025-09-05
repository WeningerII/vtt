import { Middleware, Context } from "../router/types";
import { logger } from "@vtt/logging";

interface Bucket {
  tokens: number;
  lastRefill: number; // ms epoch
  strikes: number; // failed attempts counter
  blockedUntil?: number; // temporary ban timestamp
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  blockDuration?: number; // ban duration for repeated violations
  maxStrikes?: number; // max violations before temp ban
}

interface RateLimitStore {
  ipBuckets: Map<string, Bucket>;
  userBuckets: Map<string, Bucket>;
  endpointBuckets: Map<string, Bucket>;
}

const store: RateLimitStore = {
  ipBuckets: new Map(),
  userBuckets: new Map(), 
  endpointBuckets: new Map(),
};

// Endpoint-specific rate limits
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': { windowMs: 15 * 60 * 1000, max: 5, blockDuration: 30 * 60 * 1000, maxStrikes: 3 },
  '/api/characters': { windowMs: 60 * 1000, max: 30 },
  '/api/monsters': { windowMs: 60 * 1000, max: 100 },
  '/api/combat/tactical-decision': { windowMs: 60 * 1000, max: 10 },
  '/api/ai/': { windowMs: 60 * 1000, max: 20 }, // AI endpoints need stricter limits
  '/api/content/upload': { windowMs: 60 * 1000, max: 5 },
};

function getBucket(store: Map<string, Bucket>, key: string, capacity: number): Bucket {
  const now = Date.now();
  const existing = store.get(key);
  if (existing) {
    // Check if temporary ban is still active
    if (existing.blockedUntil && now < existing.blockedUntil) {
      return existing;
    }
    // Clear temporary ban if expired
    if (existing.blockedUntil && now >= existing.blockedUntil) {
      existing.blockedUntil = undefined;
      existing.strikes = 0;
    }
    return existing;
  }
  const bucket: Bucket = { tokens: capacity, lastRefill: now, strikes: 0 };
  store.set(key, bucket);
  return bucket;
}

function getEndpointPattern(path: string): string {
  // Match specific patterns for endpoint-specific limits
  for (const pattern of Object.keys(ENDPOINT_LIMITS)) {
    if (path.startsWith(pattern)) {
      return pattern;
    }
  }
  return 'default';
}

function getClientIdentifier(ctx: Context): { ip: string; userId?: string } {
  const ip = ctx.req.headers['x-forwarded-for'] as string || 
            ctx.req.headers['x-real-ip'] as string ||
            ctx.req.socket.remoteAddress || 
            'unknown';
  
  // Extract user ID from auth header for authenticated rate limiting
  const authHeader = ctx.req.headers['authorization'];
  let userId: string | undefined;
  
  if (authHeader) {
    // Simple JWT payload extraction (in production, use proper JWT library)
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = payload.userId || payload.sub;
    } catch {
      // Invalid token, ignore
    }
  }
  
  return { ip: Array.isArray(ip) ? ip[0] : ip, userId };
}

function updateTokens(bucket: Bucket, config: RateLimitConfig): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  
  if (elapsed >= config.windowMs) {
    const windows = Math.floor(elapsed / config.windowMs);
    bucket.tokens = Math.min(config.max, bucket.tokens + windows * config.max);
    bucket.lastRefill = now;
  }
}

function handleRateLimit(bucket: Bucket, config: RateLimitConfig, identifier: string, ctx: Context): boolean {
  const now = Date.now();
  
  // Check if temporarily banned
  if (bucket.blockedUntil && now < bucket.blockedUntil) {
    const remainingBan = Math.ceil((bucket.blockedUntil - now) / 1000);
    ctx.res.setHeader('Retry-After', remainingBan.toString());
    ctx.res.setHeader('X-RateLimit-Blocked-Until', bucket.blockedUntil.toString());
    logger.warn(`Rate limit: ${identifier} is temporarily banned for ${remainingBan}s`);
    return false;
  }
  
  updateTokens(bucket, config);
  
  if (bucket.tokens <= 0) {
    bucket.strikes += 1;
    
    // Apply temporary ban after repeated violations
    if (config.maxStrikes && config.blockDuration && bucket.strikes >= config.maxStrikes) {
      bucket.blockedUntil = now + config.blockDuration;
      logger.warn(`Rate limit: ${identifier} temporarily banned after ${bucket.strikes} strikes`);
    }
    
    ctx.res.setHeader('Retry-After', Math.ceil(config.windowMs / 1000).toString());
    ctx.res.setHeader('X-RateLimit-Limit', config.max.toString());
    ctx.res.setHeader('X-RateLimit-Remaining', '0');
    ctx.res.setHeader('X-RateLimit-Reset', (bucket.lastRefill + config.windowMs).toString());
    
    return false;
  }
  
  bucket.tokens -= 1;
  bucket.strikes = Math.max(0, bucket.strikes - 0.1); // Slowly reduce strikes for good behavior
  
  // Set rate limit headers for successful requests
  ctx.res.setHeader('X-RateLimit-Limit', config.max.toString());
  ctx.res.setHeader('X-RateLimit-Remaining', bucket.tokens.toString());
  ctx.res.setHeader('X-RateLimit-Reset', (bucket.lastRefill + config.windowMs).toString());
  
  return true;
}

/**
 * Advanced multi-layered rate limiter with IP, user, and endpoint-specific limits
 * Features:
 * - Per-IP rate limiting with temporary bans
 * - Per-user rate limiting for authenticated requests  
 * - Endpoint-specific limits for sensitive operations
 * - Adaptive penalties for repeated violations
 * - Comprehensive rate limit headers
 */
export const rateLimitMiddleware: Middleware = async (ctx, _next) => {
  if (ctx.req.method === "OPTIONS") {return _next();}

  const { ip, userId } = getClientIdentifier(ctx);
  const endpoint = getEndpointPattern(ctx.req.url || '');
  
  // Default rate limits
  const defaultConfig: RateLimitConfig = {
    windowMs: Math.max(100, Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000)),
    max: Math.max(1, Number(process.env.RATE_LIMIT_MAX ?? 100)),
    blockDuration: 15 * 60 * 1000, // 15 minute ban
    maxStrikes: 5,
  };
  
  const config = ENDPOINT_LIMITS[endpoint] || defaultConfig;
  
  // Check IP-based rate limit
  const ipBucket = getBucket(store.ipBuckets, ip, config.max);
  if (!handleRateLimit(ipBucket, config, `IP:${ip}`, ctx)) {
    ctx.res.writeHead(429, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ 
      error: "Rate limit exceeded", 
      message: "Too many requests from this IP address",
      requestId: ctx.requestId,
      retryAfter: ctx.res.getHeader('Retry-After')
    }));
    return;
  }
  
  // Check user-based rate limit for authenticated requests
  if (userId) {
    const userBucket = getBucket(store.userBuckets, userId, config.max * 2); // Higher limit for authenticated users
    if (!handleRateLimit(userBucket, { ...config, max: config.max * 2 }, `User:${userId}`, ctx)) {
      ctx.res.writeHead(429, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ 
        error: "Rate limit exceeded", 
        message: "Too many requests from this user account",
        requestId: ctx.requestId,
        retryAfter: ctx.res.getHeader('Retry-After')
      }));
      return;
    }
  }
  
  // Check endpoint-specific limits for sensitive operations
  if (endpoint !== 'default') {
    const endpointKey = `${endpoint}:${userId || ip}`;
    const endpointBucket = getBucket(store.endpointBuckets, endpointKey, config.max);
    if (!handleRateLimit(endpointBucket, config, `Endpoint:${endpointKey}`, ctx)) {
      ctx.res.writeHead(429, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ 
        error: "Rate limit exceeded", 
        message: `Too many requests to ${endpoint}`,
        requestId: ctx.requestId,
        retryAfter: ctx.res.getHeader('Retry-After')
      }));
      return;
    }
  }
  
  return _next();
};

/**
 * Cleanup middleware to periodically remove old buckets and prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  [store.ipBuckets, store.userBuckets, store.endpointBuckets].forEach(bucketMap => {
    for (const [key, bucket] of bucketMap.entries()) {
      if (now - bucket.lastRefill > maxAge && !bucket.blockedUntil) {
        bucketMap.delete(key);
      }
    }
  });
}, 60 * 60 * 1000); // Run cleanup every hour
