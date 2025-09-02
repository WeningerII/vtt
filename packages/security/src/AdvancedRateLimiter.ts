/**
 * Advanced Rate Limiting with IP-based tracking, sliding windows, and intelligent threat detection
 */
import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  onLimitReached?: (req: any, rateLimitInfo: RateLimitInfo) => void;
  store?: 'memory' | 'redis';
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

export interface RateLimitInfo {
  totalRequests: number;
  totalTime: number;
  timeToReset: number;
  limit: number;
}

export interface RequestInfo {
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  userId?: string;
  timestamp: number;
  success: boolean;
}

interface StoredRequest {
  timestamp: number;
  success: boolean;
  endpoint: string;
  userId?: string;
}

export class AdvancedRateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private store = new Map<string, StoredRequest[]>();
  private suspiciousIPs = new Map<string, { count: number; firstSeen: number }>();
  private redisClient: any = null;

  constructor(config: RateLimitConfig) {
    super();
    this.config = config;
    
    if (config.store === 'redis') {
      this.initializeRedis();
    }

    // Cleanup interval every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Initialize Redis connection for distributed rate limiting
   */
  private async initializeRedis(): Promise<void> {
    try {
      const Redis = require('ioredis');
      this.redisClient = new Redis({
        host: this.config.redisConfig!.host,
        port: this.config.redisConfig!.port,
        password: this.config.redisConfig?.password,
        db: this.config.redisConfig?.db || 0,
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis rate limiter error:', err);
        // Fallback to memory store
        this.redisClient = null;
      });

      logger.info('Redis rate limiter initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis rate limiter:', error);
      // Use memory store as fallback
    }
  }

  /**
   * Check if request should be rate limited
   */
  async checkRateLimit(req: any): Promise<{
    allowed: boolean;
    rateLimitInfo: RateLimitInfo;
    retryAfter?: number;
  }> {
    const key = this.generateKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get request history
    const requests = await this.getRequests(key);
    
    // Filter requests within the current window
    const windowRequests = requests.filter(r => r.timestamp >= windowStart);

    // Check if we should skip this request type
    const requestInfo: RequestInfo = {
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      endpoint: req.route?.path || req.path,
      method: req.method,
      userId: req.user?.id,
      timestamp: now,
      success: true // Will be updated after request completion
    };

    if (this.shouldSkipRequest(requestInfo, windowRequests)) {
      return {
        allowed: true,
        rateLimitInfo: {
          totalRequests: windowRequests.length,
          totalTime: this.config.windowMs,
          timeToReset: this.config.windowMs - (now - windowStart),
          limit: this.config.maxRequests
        }
      };
    }

    // Check rate limit
    if (windowRequests.length >= this.config.maxRequests) {
      const oldestRequest = windowRequests[0];
      const retryAfter = Math.ceil((oldestRequest.timestamp + this.config.windowMs - now) / 1000);

      // Track suspicious activity
      this.trackSuspiciousActivity(requestInfo);

      // Call rate limit callback
      if (this.config.onLimitReached) {
        this.config.onLimitReached(req, {
          totalRequests: windowRequests.length,
          totalTime: this.config.windowMs,
          timeToReset: retryAfter * 1000,
          limit: this.config.maxRequests
        });
      }

      this.emit('rateLimitExceeded', {
        key,
        requests: windowRequests.length,
        limit: this.config.maxRequests,
        ip: requestInfo.ip,
        endpoint: requestInfo.endpoint
      });

      return {
        allowed: false,
        rateLimitInfo: {
          totalRequests: windowRequests.length,
          totalTime: this.config.windowMs,
          timeToReset: retryAfter * 1000,
          limit: this.config.maxRequests
        },
        retryAfter
      };
    }

    // Allow request and store it
    await this.storeRequest(key, {
      timestamp: now,
      success: true,
      endpoint: requestInfo.endpoint,
      userId: requestInfo.userId
    });

    return {
      allowed: true,
      rateLimitInfo: {
        totalRequests: windowRequests.length + 1,
        totalTime: this.config.windowMs,
        timeToReset: this.config.windowMs,
        limit: this.config.maxRequests
      }
    };
  }

  /**
   * Update request status after completion
   */
  async updateRequestStatus(req: any, success: boolean): Promise<void> {
    const key = this.generateKey(req);
    const requests = await this.getRequests(key);
    
    if (requests.length > 0) {
      const latest = requests[requests.length - 1];
      latest.success = success;
      await this.storeRequests(key, requests);
    }

    // Track failed requests for security monitoring
    if (!success) {
      const requestInfo: RequestInfo = {
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.route?.path || req.path,
        method: req.method,
        userId: req.user?.id,
        timestamp: Date.now(),
        success: false
      };

      this.trackSuspiciousActivity(requestInfo);
    }
  }

  /**
   * Get current rate limit status for a request
   */
  async getRateLimitStatus(req: any): Promise<RateLimitInfo> {
    const key = this.generateKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const requests = await this.getRequests(key);
    const windowRequests = requests.filter(r => r.timestamp >= windowStart);

    return {
      totalRequests: windowRequests.length,
      totalTime: this.config.windowMs,
      timeToReset: this.config.windowMs - (now - windowStart),
      limit: this.config.maxRequests
    };
  }

  /**
   * Check if IP is considered suspicious
   */
  isSuspiciousIP(ip: string): boolean {
    const suspiciousInfo = this.suspiciousIPs.get(ip);
    if (!suspiciousInfo) return false;

    // Consider IP suspicious if it has many failed attempts in the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return suspiciousInfo.count >= 10 && suspiciousInfo.firstSeen > oneHourAgo;
  }

  /**
   * Get suspicious activity report
   */
  getSuspiciousActivityReport(): Array<{
    ip: string;
    failedAttempts: number;
    firstSeen: Date;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const report: Array<{
      ip: string;
      failedAttempts: number;
      firstSeen: Date;
      riskLevel: 'low' | 'medium' | 'high';
    }> = [];

    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const [ip, info] of this.suspiciousIPs.entries()) {
      if (info.firstSeen > oneHourAgo) {
        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        if (info.count >= 20) riskLevel = 'high';
        else if (info.count >= 10) riskLevel = 'medium';

        report.push({
          ip,
          failedAttempts: info.count,
          firstSeen: new Date(info.firstSeen),
          riskLevel
        });
      }
    }

    return report.sort((a, b) => b.failedAttempts - a.failedAttempts);
  }

  /**
   * Temporarily block an IP address
   */
  async blockIP(ip: string, durationMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const blockKey = `blocked:${ip}`;
    const blockUntil = Date.now() + durationMs;

    if (this.redisClient) {
      await this.redisClient.set(blockKey, blockUntil, 'PX', durationMs);
    } else {
      // Store in memory with cleanup
      this.store.set(blockKey, [{ timestamp: blockUntil, success: false, endpoint: 'blocked' }]);
    }

    this.emit('ipBlocked', { ip, duration: durationMs });
    logger.warn(`IP ${ip} blocked for ${durationMs}ms due to suspicious activity`);
  }

  /**
   * Check if IP is currently blocked
   */
  async isIPBlocked(ip: string): Promise<boolean> {
    const blockKey = `blocked:${ip}`;
    
    if (this.redisClient) {
      const blockUntil = await this.redisClient.get(blockKey);
      return blockUntil && parseInt(blockUntil) > Date.now();
    } else {
      const blockInfo = this.store.get(blockKey);
      return blockInfo && blockInfo[0] && blockInfo[0].timestamp > Date.now();
    }
  }

  private generateKey(req: any): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    const ip = this.getClientIP(req);
    const userId = req.user?.id;
    const endpoint = req.route?.path || req.path;

    // Create composite key for more granular rate limiting
    return userId ? `user:${userId}:${endpoint}` : `ip:${ip}:${endpoint}`;
  }

  private getClientIP(req: any): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  private shouldSkipRequest(requestInfo: RequestInfo, windowRequests: StoredRequest[]): boolean {
    if (this.config.skipSuccessfulRequests && requestInfo.success) {
      return true;
    }

    if (this.config.skipFailedRequests && !requestInfo.success) {
      return true;
    }

    return false;
  }

  private async getRequests(key: string): Promise<StoredRequest[]> {
    if (this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : [];
      } catch (error) {
        logger.error('Redis get error:', error);
        return [];
      }
    } else {
      return this.store.get(key) || [];
    }
  }

  private async storeRequest(key: string, request: StoredRequest): Promise<void> {
    const requests = await this.getRequests(key);
    requests.push(request);
    await this.storeRequests(key, requests);
  }

  private async storeRequests(key: string, requests: StoredRequest[]): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(requests), 'PX', this.config.windowMs * 2);
      } catch (error) {
        logger.error('Redis set error:', error);
      }
    } else {
      this.store.set(key, requests);
    }
  }

  private trackSuspiciousActivity(requestInfo: RequestInfo): void {
    if (requestInfo.success) return;

    const existing = this.suspiciousIPs.get(requestInfo.ip);
    if (existing) {
      existing.count++;
    } else {
      this.suspiciousIPs.set(requestInfo.ip, {
        count: 1,
        firstSeen: Date.now()
      });
    }

    // Auto-block IPs with excessive failed attempts
    const info = this.suspiciousIPs.get(requestInfo.ip)!;
    if (info.count >= 50) {
      this.blockIP(requestInfo.ip, 24 * 60 * 60 * 1000); // Block for 24 hours
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs * 2;

    // Clean up memory store
    for (const [key, requests] of this.store.entries()) {
      if (key.startsWith('blocked:')) continue;
      
      const filtered = requests.filter(r => r.timestamp > cutoff);
      if (filtered.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, filtered);
      }
    }

    // Clean up suspicious IPs
    const oneHourAgo = now - (60 * 60 * 1000);
    for (const [ip, info] of this.suspiciousIPs.entries()) {
      if (info.firstSeen < oneHourAgo) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }
}
