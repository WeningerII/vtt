/**
 * Comprehensive Security Middleware Suite
 */
import { Request, Response, NextFunction } from 'express';
import { AdvancedRateLimiter } from './AdvancedRateLimiter';
import { InputValidator } from './InputValidator';
import { logger } from '@vtt/logging';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export interface SecurityConfig {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    store: "redis" | "memory";
    redisConfig?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    };
  };
  cors: {
    origins: string[];
    credentials: boolean;
    methods: string[];
  };
  helmet: {
    contentSecurityPolicy: boolean;
    hsts: boolean;
    noSniff: boolean;
    xssFilter: boolean;
  };
  inputValidation: {
    enableSanitization: boolean;
    enableXSSProtection: boolean;
    enableSQLInjectionProtection: boolean;
  };
}

export class SecurityMiddleware {
  private rateLimiter: AdvancedRateLimiter;
  private inputValidator: InputValidator;
  private config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.rateLimiter = new AdvancedRateLimiter({
      windowMs: config.rateLimiting.windowMs,
      maxRequests: config.rateLimiting.maxRequests,
      store: config.rateLimiting.store,
      ...(config.rateLimiting.redisConfig && { redisConfig: config.rateLimiting.redisConfig }),
      keyGenerator: (req: Request) => this.generateRateLimitKey(req),
      onLimitReached: (req: Request, info) => this.handleRateLimitExceeded(req, info)
    });
    this.inputValidator = new InputValidator();
  }

  /**
   * Apply all security middleware to Express app
   */
  applySecurityMiddleware(app: any): void {
    // Basic security headers
    app.use(helmet({
      contentSecurityPolicy: this.config.helmet.contentSecurityPolicy ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
          fontSrc: ["'self'", 'fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
        },
      } : false,
      hsts: this.config.helmet.hsts ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      } : false,
      noSniff: this.config.helmet.noSniff,
      xssFilter: this.config.helmet.xssFilter
    }));

    // CORS configuration
    app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin as string;
      if (this.config.cors.origins.includes(origin) || this.config.cors.origins.includes('*')) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      
      res.header('Access-Control-Allow-Credentials', this.config.cors.credentials.toString());
      res.header('Access-Control-Allow-Methods', this.config.cors.methods.join(', '));
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Rate limiting middleware
    app.use(this.createRateLimitMiddleware());

    // Input validation middleware
    if (this.config.inputValidation.enableSanitization) {
      app.use(this.createInputValidationMiddleware());
    }

    // IP blocking middleware
    app.use(this.createIPBlockingMiddleware());
  }

  /**
   * Create rate limiting middleware
   */
  private createRateLimitMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await this.rateLimiter.checkRateLimit(req);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': result.rateLimitInfo.limit.toString(),
          'X-RateLimit-Remaining': Math.max(0, result.rateLimitInfo.limit - result.rateLimitInfo.totalRequests).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + result.rateLimitInfo.timeToReset).toISOString()
        });

        if (!result.allowed) {
          res.set('Retry-After', result.retryAfter?.toString() || '60');
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: result.retryAfter
          });
        }

        next();
      } catch (error) {
        logger.error('Rate limiting error:', error as Record<string, any>);
        next(); // Continue on error to avoid breaking the app
      }
    };
  }

  /**
   * Create input validation middleware
   */
  private createInputValidationMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Skip validation for certain content types
        if (req.is('multipart/form-data') || req.is('application/octet-stream')) {
          return next();
        }

        const validationOptions = {
          stripHtml: true,
          normalizeWhitespace: true,
          trimStrings: true,
          removeScripts: this.config.inputValidation.enableXSSProtection,
          maxLength: 10000
        };

        // Validate and sanitize request body
        if (req.body && Object.keys(req.body).length > 0) {
          const result = this.inputValidator.validateInput(req.body, undefined, validationOptions);
          
          if (!result.valid) {
            const securityErrors = result.errors.filter(err => 
              err.code === 'XSS_DETECTED' || err.code === 'SQL_INJECTION'
            );

            if (securityErrors.length > 0) {
              logger.warn('Security threat detected in request:', {
                ip: req.ip,
                path: req.path,
                errors: securityErrors,
                userAgent: req.get('User-Agent')
              });

              return res.status(400).json({
                error: 'Invalid input detected',
                message: 'Your request contains potentially harmful content'
              });
            }

            return res.status(400).json({
              error: 'Validation failed',
              details: result.errors
            });
          }

          // Use sanitized data
          req.body = result.sanitized;
        }

        // Validate query parameters
        if (req.query && Object.keys(req.query).length > 0) {
          const result = this.inputValidator.validateInput(req.query, undefined, validationOptions);
          
          if (!result.valid) {
            const securityErrors = result.errors.filter(err => 
              err.code === 'XSS_DETECTED' || err.code === 'SQL_INJECTION'
            );

            if (securityErrors.length > 0) {
              return res.status(400).json({
                error: 'Invalid query parameters',
                message: 'Query parameters contain potentially harmful content'
              });
            }
          }

          req.query = result.sanitized;
        }

        next();
      } catch (error) {
        logger.error('Input validation error:', error as Record<string, any>);
        next(); // Continue on error
      }
    };
  }

  /**
   * Create IP blocking middleware
   */
  private createIPBlockingMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const clientIP = this.getClientIP(req);
        const isBlocked = await this.rateLimiter.isIPBlocked(clientIP);
        
        if (isBlocked) {
          logger.warn(`Blocked IP attempted access: ${clientIP}`);
          return res.status(403).json({
            error: 'Access Denied',
            message: 'Your IP address has been temporarily blocked due to suspicious activity'
          });
        }

        // Check if IP is suspicious
        if (this.rateLimiter.isSuspiciousIP(clientIP)) {
          logger.warn(`Suspicious IP activity: ${clientIP}`);
          // Add additional headers for monitoring
          res.set('X-Security-Warning', 'Suspicious activity detected');
        }

        next();
      } catch (error) {
        logger.error('IP blocking check error:', error as Record<string, any>);
        next(); // Continue on error
      }
    };
  }

  /**
   * Endpoint-specific rate limiting
   */
  createEndpointRateLimit(options: {
    windowMs: number;
    maxRequests: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
  }) {
    return rateLimit({
      windowMs: options.windowMs,
      max: options.maxRequests,
      message: options.message || 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      keyGenerator: (req: Request) => this.getClientIP(req),
      handler: (req: Request, res: Response) => {
        logger.warn(`Rate limit exceeded for IP: ${this.getClientIP(req)} on ${req.path}`);
        res.status(429).json({
          error: 'Too Many Requests',
          message: options.message || 'Rate limit exceeded'
        });
      }
    });
  }

  /**
   * File upload security middleware
   */
  createFileUploadSecurity(options: {
    maxFileSize: number;
    allowedMimeTypes: string[];
    maxFiles?: number;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      // This would typically be used with multer or similar
      // Implementation depends on the file upload library being used
      
      if ((req as any).files) {
        const files = Array.isArray((req as any).files) ? (req as any).files : Object.values((req as any).files).flat();
        
        for (const file of files as any[]) {
          // Validate file type
          if (!options.allowedMimeTypes.includes(file.mimetype)) {
            return res.status(400).json({
              error: 'Invalid file type',
              message: `File type ${file.mimetype} is not allowed`
            });
          }

          // Validate file size
          if (file.size > options.maxFileSize) {
            return res.status(400).json({
              error: 'File too large',
              message: `File size exceeds limit of ${options.maxFileSize} bytes`
            });
          }

          // Validate file using InputValidator
          const validationResult = this.inputValidator.validateFileUpload({
            name: file.originalname,
            size: file.size,
            type: file.mimetype
          });

          if (!validationResult.valid) {
            return res.status(400).json({
              error: 'File validation failed',
              details: validationResult.errors
            });
          }
        }
      }

      next();
    };
  }

  /**
   * Security monitoring and reporting
   */
  getSecurityReport(): {
    suspiciousIPs: Array<{
      ip: string;
      failedAttempts: number;
      firstSeen: Date;
      riskLevel: 'low' | 'medium' | 'high';
    }>;
    rateLimitStats: {
      totalBlocked: number;
      activeBlocks: number;
    };
  } {
    return {
      suspiciousIPs: this.rateLimiter.getSuspiciousActivityReport(),
      rateLimitStats: {
        totalBlocked: 0, // This would be tracked by the rate limiter
        activeBlocks: 0
      }
    };
  }

  private generateRateLimitKey(req: Request): string {
    const ip = this.getClientIP(req);
    const userId = (req as any).user?.id;
    const endpoint = req.route?.path || req.path;
    
    // Create hierarchical key for different rate limit scopes
    if (userId) {
      return `user:${userId}:${endpoint}`;
    }
    return `ip:${ip}:${endpoint}`;
  }

  private getClientIP(req: Request): string {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection as any).socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.toString().split(',')[0] || 
           'unknown';
  }

  private handleRateLimitExceeded(req: Request, info: any): void {
    logger.warn('Rate limit exceeded:', {
      ip: this.getClientIP(req),
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      rateLimitInfo: info
    });

    // Could trigger additional security measures here
    // e.g., temporary IP blocking, alerting, etc.
  }
}
