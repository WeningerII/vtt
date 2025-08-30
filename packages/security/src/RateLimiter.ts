/**
 * Rate Limiting System
 * Advanced rate limiting with sliding windows, token buckets, and adaptive limits
 */

import { EventEmitter } from 'events';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  resetTime?: Date;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface RateLimitInfo {
  totalRequests: number;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
  reason?: string;
}

export interface TokenBucketConfig {
  capacity: number; // Maximum tokens
  refillRate: number; // Tokens per second
  initialTokens?: number;
}

export interface AdaptiveRateLimitConfig {
  baseLimit: number;
  maxLimit: number;
  minLimit: number;
  adaptationFactor: number; // 0-1, how much to adapt based on system load
  loadThreshold: number; // 0-1, system load threshold for adaptation
}

export class RateLimiter extends EventEmitter {
  private windows = new Map<string, { count: number; resetTime: number }>();
  protected config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    super();
    this.config = config;
    this.startCleanup();
  }

  /**
   * Check if a request should be rate limited
   */
  checkLimit(identifier: string): RateLimitResult {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    
    // Get or create window
    let window = this.windows.get(key);
    if (!window || now >= window.resetTime) {
      window = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.windows.set(key, window);
    }

    const remainingRequests = Math.max(0, this.config.max - window.count);
    const allowed = window.count < this.config.max;

    if (allowed) {
      window.count++;
    }

    const info: RateLimitInfo = {
      totalRequests: window.count,
      remainingRequests: allowed ? remainingRequests - 1 : remainingRequests,
      resetTime: new Date(window.resetTime),
    };
    if (!allowed) {
      info.retryAfter = Math.ceil((window.resetTime - now) / 1000);
    }

    const result: RateLimitResult = {
      allowed,
      info,
      ...(allowed ? {} : { reason: this.config.message || 'Rate limit exceeded' }),
    };

    this.emit(allowed ? 'request' : 'rateLimited', { key, identifier, result });

    return result;
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    this.windows.delete(key);
    this.emit('reset', { key, identifier });
  }

  /**
   * Get current statistics
   */
  getStats(): {
    activeWindows: number;
    totalRequests: number;
    rateLimitedRequests: number;
  } {
    let totalRequests = 0;
    let rateLimitedRequests = 0;

    for (const window of this.windows.values()) {
      totalRequests += window.count;
      if (window.count >= this.config.max) {
        rateLimitedRequests++;
      }
    }

    return {
      activeWindows: this.windows.size,
      totalRequests,
      rateLimitedRequests,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, window] of this.windows) {
        if (now >= window.resetTime) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.windows.delete(key);
      }

      this.emit('cleanup', { removedWindows: keysToDelete.length });
    }, this.config.windowMs / 2); // Cleanup twice per window
  }

  /**
   * Destroy rate limiter and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.windows.clear();
    this.removeAllListeners();
  }
}

/**
 * Token Bucket Rate Limiter
 */
export class TokenBucketRateLimiter extends EventEmitter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private config: TokenBucketConfig;
  private refillInterval: NodeJS.Timeout | null = null;

  constructor(config: TokenBucketConfig) {
    super();
    this.config = config;
    this.startRefill();
  }

  /**
   * Try to consume tokens
   */
  consume(identifier: string, tokens = 1): RateLimitResult {
    let bucket = this.buckets.get(identifier);
    if (!bucket) {
      bucket = {
        tokens: this.config.initialTokens ?? this.config.capacity,
        lastRefill: Date.now(),
      };
      this.buckets.set(identifier, bucket);
    }

    const allowed = bucket.tokens >= tokens;
    if (allowed) {
      bucket.tokens -= tokens;
    }

    const info: RateLimitInfo = {
      totalRequests: this.config.capacity - bucket.tokens,
      remainingRequests: Math.floor(bucket.tokens),
      resetTime: new Date(
        Date.now() + ((this.config.capacity - bucket.tokens) / this.config.refillRate) * 1000
      ),
    };
    if (!allowed) {
      info.retryAfter = Math.ceil((tokens - bucket.tokens) / this.config.refillRate);
    }
    const result: RateLimitResult = {
      allowed,
      info,
    };

    this.emit(allowed ? 'consumed' : 'rateLimited', { identifier, tokens, bucket: { ...bucket }, result });

    return result;
  }

  /**
   * Add tokens to a bucket
   */
  addTokens(identifier: string, tokens: number): void {
    let bucket = this.buckets.get(identifier);
    if (!bucket) {
      bucket = {
        tokens: this.config.initialTokens ?? this.config.capacity,
        lastRefill: Date.now(),
      };
      this.buckets.set(identifier, bucket);
    }

    bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokens);
    this.emit('tokensAdded', { identifier, tokens, newTotal: bucket.tokens });
  }

  private startRefill(): void {
    this.refillInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [, bucket] of this.buckets) {
        const timeSinceRefill = (now - bucket.lastRefill) / 1000;
        const tokensToAdd = timeSinceRefill * this.config.refillRate;
        
        if (tokensToAdd >= 1) {
          bucket.tokens = Math.min(this.config.capacity, bucket.tokens + Math.floor(tokensToAdd));
          bucket.lastRefill = now;
        }
      }
    }, 1000); // Refill every second
  }

  /**
   * Destroy token bucket and cleanup resources
   */
  destroy(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }
    this.buckets.clear();
    this.removeAllListeners();
  }
}

/**
 * Adaptive Rate Limiter
 */
export class AdaptiveRateLimiter extends RateLimiter {
  private adaptiveConfig: AdaptiveRateLimitConfig;
  private currentLimit: number;
  private systemLoadMonitor?: () => number; // Function that returns system load 0-1

  constructor(config: RateLimitConfig, adaptiveConfig: AdaptiveRateLimitConfig) {
    super(config);
    this.adaptiveConfig = adaptiveConfig;
    this.currentLimit = adaptiveConfig.baseLimit;
    this.startAdaptation();
  }

  /**
   * Set system load monitor function
   */
  setSystemLoadMonitor(monitor: () => number): void {
    this.systemLoadMonitor = monitor;
  }

  /**
   * Check limit with adaptive adjustment
   */
  override checkLimit(identifier: string): RateLimitResult {
    // Update config with current adaptive limit
    this.config.max = this.currentLimit;
    return super.checkLimit(identifier);
  }

  private startAdaptation(): void {
    setInterval(() => {
      if (!this.systemLoadMonitor) return;

      const systemLoad = this.systemLoadMonitor();
      
      if (systemLoad > this.adaptiveConfig.loadThreshold) {
        // High load - decrease limit
        const reduction = (systemLoad - this.adaptiveConfig.loadThreshold) * this.adaptiveConfig.adaptationFactor;
        this.currentLimit = Math.max(
          this.adaptiveConfig.minLimit,
          this.currentLimit - (this.adaptiveConfig.baseLimit * reduction)
        );
      } else {
        // Normal/low load - increase limit toward base
        const increase = (this.adaptiveConfig.loadThreshold - systemLoad) * this.adaptiveConfig.adaptationFactor * 0.5;
        this.currentLimit = Math.min(
          this.adaptiveConfig.maxLimit,
          this.currentLimit + (this.adaptiveConfig.baseLimit * increase)
        );
      }

      this.emit('limitAdapted', { 
        systemLoad, 
        oldLimit: this.config.max, 
        newLimit: this.currentLimit 
      });
    }, 5000); // Adapt every 5 seconds
  }
}

/**
 * Rate Limiter Manager
 */
export class RateLimiterManager {
  private limiters = new Map<string, RateLimiter>();
  private globalLimiter?: RateLimiter;

  /**
   * Add a rate limiter for a specific resource
   */
  addLimiter(name: string, limiter: RateLimiter): void {
    this.limiters.set(name, limiter);
  }

  /**
   * Set global rate limiter
   */
  setGlobalLimiter(limiter: RateLimiter): void {
    this.globalLimiter = limiter;
  }

  /**
   * Check all applicable rate limits
   */
  checkLimits(identifier: string, resource?: string): RateLimitResult[] {
    const results: RateLimitResult[] = [];

    // Check global limiter first
    if (this.globalLimiter) {
      results.push(this.globalLimiter.checkLimit(identifier));
    }

    // Check resource-specific limiter
    if (resource && this.limiters.has(resource)) {
      results.push(this.limiters.get(resource)!.checkLimit(identifier));
    }

    return results;
  }

  /**
   * Check if any rate limit is exceeded
   */
  isRateLimited(identifier: string, resource?: string): { limited: boolean; results: RateLimitResult[] } {
    const results = this.checkLimits(identifier, resource);
    const limited = results.some(result => !result.allowed);
    
    return { limited, results };
  }

  /**
   * Get combined statistics
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    if (this.globalLimiter) {
      stats.global = this.globalLimiter.getStats();
    }

    for (const [name, limiter] of this.limiters) {
      stats[name] = limiter.getStats();
    }

    return stats;
  }

  /**
   * Reset all rate limits for an identifier
   */
  resetAll(identifier: string): void {
    if (this.globalLimiter) {
      this.globalLimiter.reset(identifier);
    }

    for (const limiter of this.limiters.values()) {
      limiter.reset(identifier);
    }
  }

  /**
   * Destroy all rate limiters
   */
  destroy(): void {
    if (this.globalLimiter) {
      this.globalLimiter.destroy();
    }

    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }

    this.limiters.clear();
  }
}

/**
 * Common rate limit configurations
 */
export const RATE_LIMIT_PRESETS = {
  // Very strict limits for sensitive operations
  strict: {
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many requests, please try again later',
  },

  // Moderate limits for general API usage
  moderate: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Rate limit exceeded, please slow down',
  },

  // Generous limits for regular users
  generous: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    message: 'Rate limit exceeded',
  },

  // File upload limits
  upload: {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many file uploads, please wait',
  },

  // Authentication limits
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many authentication attempts',
  },
};
