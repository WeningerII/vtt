/**
 * Security Middleware and Rate Limiting
 */

import { EventEmitter } from 'events';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import helmet from 'helmet';
import { AuthManager } from './AuthManager';
import { AuthorizationManager } from './AuthorizationManager';
import {
  SecurityContext,
  RateLimitConfig,
  SecuritySettings,
  AuditLogEntry
} from './types';

export class SecurityMiddleware extends EventEmitter {
  private authManager: AuthManager;
  private authzManager: AuthorizationManager;
  private rateLimiters: Map<string, RateLimiterMemory> = new Map();
  private securitySettings: SecuritySettings;
  private blockedIPs = new Set<string>();
  private suspiciousActivity = new Map<string, SuspiciousActivityTracker>();

  constructor(
    authManager: AuthManager,
    authzManager: AuthorizationManager,
    settings: SecuritySettings
  ) {
    super();
    this.authManager = authManager;
    this.authzManager = authzManager;
    this.securitySettings = settings;
    this.initializeRateLimiters();
    this.startSecurityMonitoring();
  }

  /**
   * Authentication middleware
   */
  authenticate() {
    return async (req: any, res: any, _next: any) => {
      try {
        const token = this.extractToken(req);
        if (!token) {
          return this.respondUnauthorized(res, 'No token provided');
        }

        const ipAddress = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || '';

        // Check if IP is blocked
        if (this.blockedIPs.has(ipAddress)) {
          this.logSecurityEvent('blocked_ip_access', '', ipAddress, userAgent);
          return res.status(403).json({ error: 'Access denied' });
        }

        // Validate token and get security context
        const context = await this.authManager.validateToken(token, ipAddress, userAgent);
        
        // Check for suspicious activity
        await this.checkSuspiciousActivity(context, req);

        // Attach security context to request
        req.securityContext = context;
        req.user = context.user;

        this.logSecurityEvent('authenticated', context.user.id, ipAddress, userAgent);
        _next();
      } catch (error) {
        this.logSecurityEvent('authentication_failed', '', this.getClientIP(req), req.get('User-Agent') || '');
        return this.respondUnauthorized(res, error instanceof Error ? error.message : 'Authentication failed');
      }
    };
  }

  /**
   * Authorization middleware
   */
  authorize(permission: string, resource?: string) {
    return (req: any, res: any, _next: any) => {
      try {
        const context = req.securityContext as SecurityContext;
        if (!context) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const resourceId = req.params.id || req.params.resourceId;
        
        if (!this.authzManager.checkPermission(context, permission as any, resource, resourceId)) {
          this.logSecurityEvent('authorization_failed', context.user.id, context.ipAddress, context.userAgent, {
            permission,
            resource,
            resourceId
          });
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: permission
          });
        }

        _next();
      } catch (error) {
        return res.status(500).json({ error: 'Authorization check failed' });
      }
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(type: string = 'general') {
    return async (req: any, res: any, _next: any) => {
      try {
        const limiter = this.rateLimiters.get(type);
        if (!limiter) {
          return _next();
        }

        const key = this.getRateLimitKey(req, type);
        const resRateLimit = await limiter.consume(key);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': limiter.points,
          'X-RateLimit-Remaining': resRateLimit.remainingPoints,
          'X-RateLimit-Reset': new Date(Date.now() + resRateLimit.msBeforeNext).toISOString()
        });

        _next();
      } catch (rejRes: any) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        this.logSecurityEvent('rate_limit_exceeded', this.getUserId(req), this.getClientIP(req), req.get('User-Agent') || '', {
          type,
          retryAfter: secs
        });

        res.set('Retry-After', String(secs));
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: secs
        });
      }
    };
  }

  /**
   * Security headers middleware
   */
  securityHeaders(): any {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          mediaSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false, // Allow WebGL contexts
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
   * Input validation middleware
   */
  validateInput(schema: ValidationSchema) {
    return (req: any, res: any, _next: any) => {
      const errors = this.validateRequestData(req, schema);
      if (errors.length > 0) {
        this.logSecurityEvent('input_validation_failed', this.getUserId(req), this.getClientIP(req), req.get('User-Agent') || '', {
          errors
        });
        return res.status(400).json({ 
          error: 'Invalid input',
          details: errors
        });
      }
      _next();
    };
  }

  /**
   * CORS middleware with security considerations
   */
  cors(allowedOrigins: string[] = []) {
    return (req: any, res: any, _next: any) => {
      const origin = req.get('Origin');
      
      if (origin && (allowedOrigins.includes(origin) || this.isDevelopment())) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
      }

      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      _next();
    };
  }

  /**
   * WebSocket security middleware
   */
  secureWebSocket() {
    return async (ws: any, req: any) => {
      try {
        const token = this.extractTokenFromWS(req);
        if (!token) {
          ws.close(1008, 'No token provided');
          return;
        }

        const ipAddress = this.getClientIP(req);
        const userAgent = req.headers['user-agent'] || '';

        if (this.blockedIPs.has(ipAddress)) {
          ws.close(1008, 'Access denied');
          return;
        }

        const context = await this.authManager.validateToken(token, ipAddress, userAgent);
        
        // Attach security context to WebSocket
        ws.securityContext = context;
        ws.isAuthenticated = true;

        this.logSecurityEvent('websocket_authenticated', context.user.id, ipAddress, userAgent);
        
        // Set up periodic token validation
        const validationInterval = setInterval(async () => {
          try {
            await this.authManager.validateToken(token, ipAddress, userAgent);
          } catch (error) {
            clearInterval(validationInterval);
            ws.close(1008, 'Token expired');
          }
        }, 5 * 60 * 1000); // Every 5 minutes

        ws.on('close', () => {
          clearInterval(validationInterval);
        });

      } catch (error) {
        this.logSecurityEvent('websocket_auth_failed', '', this.getClientIP(req), req.headers['user-agent'] || '');
        ws.close(1008, 'Authentication failed');
      }
    };
  }

  /**
   * Intrusion detection system
   */
  async detectIntrusion(req: any, res: any, _next: any) {
    const ipAddress = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const userId = this.getUserId(req);

    // Check for SQL injection patterns
    if (this.detectSQLInjection(req)) {
      await this.handleSecurityThreat('sql_injection', userId, ipAddress, userAgent, req);
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Check for XSS patterns
    if (this.detectXSS(req)) {
      await this.handleSecurityThreat('xss_attempt', userId, ipAddress, userAgent, req);
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Check for path traversal
    if (this.detectPathTraversal(req)) {
      await this.handleSecurityThreat('path_traversal', userId, ipAddress, userAgent, req);
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Check for unusual patterns
    if (await this.detectAnomalousActivity(req)) {
      await this.handleSecurityThreat('anomalous_activity', userId, ipAddress, userAgent, req);
    }

    _next();
  }

  /**
   * Block IP address
   */
  blockIP(ipAddress: string, reason: string = 'Security violation'): void {
    this.blockedIPs.add(ipAddress);
    this.logSecurityEvent('ip_blocked', '', ipAddress, '', { reason });
    
    // Auto-unblock after 24 hours
    setTimeout(() => {
      this.unblockIP(ipAddress);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Unblock IP address
   */
  unblockIP(ipAddress: string): void {
    this.blockedIPs.delete(ipAddress);
    this.logSecurityEvent('ip_unblocked', '', ipAddress, '');
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    return {
      blockedIPs: this.blockedIPs.size,
      suspiciousActivities: this.suspiciousActivity.size,
      rateLimiterStats: this.getRateLimiterStats(),
      lastSecurityEvents: this.getRecentSecurityEvents()
    };
  }

  // Private helper methods

  private initializeRateLimiters(): void {
    const configs = {
      login: { points: 5, duration: 60 * 15 }, // 5 attempts per 15 minutes
      register: { points: 3, duration: 60 * 60 }, // 3 attempts per hour
      passwordReset: { points: 3, duration: 60 * 60 }, // 3 attempts per hour
      general: { points: 100, duration: 60 * 15 }, // 100 requests per 15 minutes
      websocket: { points: 10, duration: 60 } // 10 connections per minute
    };

    Object.entries(configs).forEach(([type, config]) => {
      this.rateLimiters.set(type, new RateLimiterMemory({
        points: config.points,
        duration: config.duration,
        blockDuration: config.duration
      }));
    });
  }

  private startSecurityMonitoring(): void {
    // Clean up old suspicious activity records every hour
    setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const [key, tracker] of this.suspiciousActivity) {
        if (tracker.lastActivity < cutoff) {
          this.suspiciousActivity.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }

  private extractToken(req: any): string | null {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check for token in cookies
    const cookieToken = req.cookies?.access_token;
    if (cookieToken) {
      return cookieToken;
    }

    // Check for token in query parameters (less secure, for WebSocket upgrades)
    const queryToken = req.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private extractTokenFromWS(req: any): string | null {
    // Check query parameters
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (token) {
      return token;
    }

    // Check headers
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  private getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  private getUserId(req: any): string {
    return req.securityContext?.user?.id || req.user?.id || '';
  }

  private getRateLimitKey(req: any, type: string): string {
    const baseKey = this.getClientIP(req);
    const userId = this.getUserId(req);
    
    if (userId && type !== 'login') {
      return `${type}:${userId}`;
    }
    
    return `${type}:${baseKey}`;
  }

  private respondUnauthorized(res: any, message: string): any {
    return res.status(401).json({ 
      error: 'Authentication failed',
      message 
    });
  }

  private async checkSuspiciousActivity(context: SecurityContext, req: any): Promise<void> {
    const key = `${context.user.id}:${context.ipAddress}`;
    const tracker = this.suspiciousActivity.get(key) || {
      userId: context.user.id,
      ipAddress: context.ipAddress,
      lastActivity: Date.now(),
      events: []
    };

    // Update activity
    tracker.lastActivity = Date.now();
    
    // Check for rapid session switching
    if (this.detectRapidSessionSwitching(tracker, context)) {
      await this.handleSecurityThreat('rapid_session_switching', context.user.id, context.ipAddress, context.userAgent, req);
    }

    this.suspiciousActivity.set(key, tracker);
  }

  private detectSQLInjection(req: any): boolean {
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(;.*--)/,
      /('.*OR.*'.*=.*')/i
    ];

    const checkString = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);
    return sqlPatterns.some(pattern => pattern.test(checkString));
  }

  private detectXSS(req: any): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi
    ];

    const checkString = JSON.stringify(req.body) + JSON.stringify(req.query);
    return xssPatterns.some(pattern => pattern.test(checkString));
  }

  private detectPathTraversal(req: any): boolean {
    const pathTraversalPatterns = [
      /\.\./g,
      /\.\.\//g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi
    ];

    const checkString = req.url + JSON.stringify(req.query) + JSON.stringify(req.params);
    return pathTraversalPatterns.some(pattern => pattern.test(checkString));
  }

  private async detectAnomalousActivity(req: any): Promise<boolean> {
    // Placeholder for machine learning-based anomaly detection
    // Would analyze request patterns, timing, etc.
    return false;
  }

  private detectRapidSessionSwitching(tracker: SuspiciousActivityTracker, context: SecurityContext): boolean {
    // Check if user is switching sessions rapidly (potential account takeover)
    const recentEvents = tracker.events.filter(e => 
      e.timestamp > Date.now() - (5 * 60 * 1000) && // Last 5 minutes
      e.type === 'session_switch'
    );

    return recentEvents.length > 3; // More than 3 session switches in 5 minutes
  }

  private async handleSecurityThreat(
    type: string, 
    userId: string, 
    ipAddress: string, 
    userAgent: string, 
    req: any
  ): Promise<void> {
    this.logSecurityEvent('security_threat_detected', userId, ipAddress, userAgent, {
      type,
      url: req.url,
      method: req.method,
      body: req.body,
      headers: req.headers
    });

    // Auto-block IP for severe threats
    const severeThreats = ['sql_injection', 'xss_attempt', 'path_traversal'];
    if (severeThreats.includes(type)) {
      this.blockIP(ipAddress, `Security threat: ${type}`);
    }

    this.emit('securityThreat', {
      type,
      userId,
      ipAddress,
      userAgent,
      severity: severeThreats.includes(type) ? 'high' : 'medium'
    });
  }

  private validateRequestData(req: any, schema: ValidationSchema): string[] {
    const errors: string[] = [];
    // Placeholder for comprehensive input validation
    // Would use libraries like Joi or express-validator
    return errors;
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private logSecurityEvent(
    action: string, 
    userId: string, 
    ipAddress: string, 
    userAgent: string, 
    details: Record<string, any> = {}
  ): void {
    const event = {
      action,
      userId,
      ipAddress,
      userAgent,
      details,
      timestamp: new Date()
    };

    this.emit('securityEvent', event);
  }

  private getRateLimiterStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [type, limiter] of this.rateLimiters) {
      stats[type] = {
        points: limiter.points,
        duration: limiter.duration
      };
    }

    return stats;
  }

  private getRecentSecurityEvents(): any[] {
    // Placeholder - would return recent security events from log
    return [];
  }
}

interface SuspiciousActivityTracker {
  userId: string;
  ipAddress: string;
  lastActivity: number;
  events: Array<{
    type: string;
    timestamp: number;
    details: Record<string, any>;
  }>;
}

interface ValidationSchema {
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
}

interface SecurityMetrics {
  blockedIPs: number;
  suspiciousActivities: number;
  rateLimiterStats: Record<string, any>;
  lastSecurityEvents: any[];
}
