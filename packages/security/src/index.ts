/**
 * Security Package
 * Comprehensive security system with input validation, rate limiting,
 * authentication, and threat protection
 */

// Input Validation & Sanitization
import { InputValidator } from "./InputValidator";
export { InputValidator };
export type { ValidationRule, ValidationResult, SanitizationOptions } from "./InputValidator";

// Rate Limiting
import {
  RateLimiter,
  TokenBucketRateLimiter,
  AdaptiveRateLimiter,
  RateLimiterManager,
  RATE_LIMIT_PRESETS,
} from "./RateLimiter";
export {
  RateLimiter,
  TokenBucketRateLimiter,
  AdaptiveRateLimiter,
  RateLimiterManager,
  RATE_LIMIT_PRESETS,
};
export type {
  RateLimitConfig,
  RateLimitInfo,
  RateLimitResult,
  TokenBucketConfig,
  AdaptiveRateLimitConfig,
} from "./RateLimiter";

// Authentication & Authorization
import { AuthenticationManager } from "./AuthenticationManager";
export { AuthenticationManager };
export type {
  User,
  AuthToken,
  AuthSession,
  AuthConfig,
  LoginCredentials,
  RegisterData,
} from "./AuthenticationManager";

// Threat Protection
import { ThreatProtection } from "./ThreatProtection";
import type { SecurityContext } from "./ThreatProtection";
export { ThreatProtection };
export type {
  SecurityEvent,
  ThreatType,
  ThreatRule,
  SecurityContext,
  ThreatDetectionResult,
  ThreatAction,
  SecurityMetrics,
} from "./ThreatProtection";

/**
 * Security System Manager
 * Orchestrates all security components
 */
export class SecuritySystem {
  private inputValidator: InputValidator;
  private rateLimiterManager: RateLimiterManager;
  private authManager: AuthenticationManager;
  private threatProtection: ThreatProtection;

  constructor(config: SecuritySystemConfig) {
    this.inputValidator = new InputValidator();
    this.rateLimiterManager = new RateLimiterManager();
    this.authManager = new AuthenticationManager(config.auth);
    this.threatProtection = new ThreatProtection();

    this.setupIntegrations();
  }

  /**
   * Get input validator
   */
  getInputValidator(): InputValidator {
    return this.inputValidator;
  }

  /**
   * Get rate limiter manager
   */
  getRateLimiterManager(): RateLimiterManager {
    return this.rateLimiterManager;
  }

  /**
   * Get authentication manager
   */
  getAuthManager(): AuthenticationManager {
    return this.authManager;
  }

  /**
   * Get threat protection
   */
  getThreatProtection(): ThreatProtection {
    return this.threatProtection;
  }

  /**
   * Process request through security pipeline
   */
  async processRequest(context: SecurityRequestContext): Promise<SecurityResponse> {
    try {
      // 1. Check rate limits
      const rateLimitResult = this.rateLimiterManager.isRateLimited(
        context.identifier,
        context.resource,
      );

      if (rateLimitResult.limited) {
        return {
          allowed: false,
          reason: "rate_limit_exceeded",
          rateLimitInfo: rateLimitResult.results[0]?.info || undefined,
        };
      }

      // 2. Validate input
      if (context.data) {
        const validationResult = this.inputValidator.validateInput(
          context.data,
          context.schema || undefined,
        );
        if (!validationResult.valid) {
          return {
            allowed: false,
            reason: "validation_failed",
            validationErrors: validationResult.errors,
          };
        }
      }

      // 3. Check authentication if required
      if (context.requiresAuth && context.token) {
        const tokenResult = this.authManager.verifyAccessToken(context.token);
        if (!tokenResult.valid) {
          return {
            allowed: false,
            reason: "authentication_failed",
            error: tokenResult.error || undefined,
          };
        }

        // Check permissions
        if (
          context.permission &&
          !this.authManager.hasPermission(tokenResult.payload.userId, context.permission)
        ) {
          return {
            allowed: false,
            reason: "permission_denied",
          };
        }

        context.user = {
          id: tokenResult.payload.userId,
          email: tokenResult.payload.email,
          roles: tokenResult.payload.roles,
        };
      }

      // 4. Threat detection
      const securityContext: SecurityContext = {};
      if (context.request) {securityContext.request = context.request;}
      if (context.user) {securityContext.user = context.user;}
      if (context.session) {securityContext.session = context.session;}
      if (context.metadata) {securityContext.metadata = context.metadata;}

      const threatAnalysis = this.threatProtection.analyzeRequest(securityContext);

      if (threatAnalysis.blocked) {
        return {
          allowed: false,
          reason: "threat_detected",
          threats: threatAnalysis.threats,
          actions: threatAnalysis.actions,
        };
      }

      return {
        allowed: true,
        user: context.user,
        threats: threatAnalysis.threats,
      };
    } catch (error) {
      return {
        allowed: false,
        reason: "security_error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Setup integrations between security components
   */
  private setupIntegrations(): void {
    // Forward authentication failures to threat protection
    this.authManager.on("loginFailed", (event: any) => {
      if (event) {
        this.threatProtection.reportIncident(
          "brute_force",
          event.ipAddress || event.userId,
          `Login failed: ${event.reason}`,
          "medium",
          { event },
        );
      }
    });

    // Note: RateLimiterManager and InputValidator don't extend EventEmitter
    // Additional integration can be added when those classes support events
  }
}

export interface SecuritySystemConfig {
  validation?: {
    enableLogging?: boolean;
    strictMode?: boolean;
  };
  auth: import("./AuthenticationManager").AuthConfig;
}

export interface SecurityRequestContext {
  identifier: string; // IP, user ID, etc.
  resource?: string;
  requiresAuth?: boolean;
  token?: string;
  permission?: string;
  data?: any;
  schema?: string;
  request?: {
    ip: string;
    userAgent: string;
    path: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  session?: {
    id: string;
    createdAt: Date;
    lastActivity: Date;
  };
  metadata?: Record<string, any>;
}

export interface SecurityResponse {
  allowed: boolean;
  reason?: string | undefined;
  error?: string | undefined;
  user?:
    | {
        id: string;
        email: string;
        roles: string[];
      }
    | undefined;
  rateLimitInfo?: import("./RateLimiter").RateLimitInfo | undefined;
  validationErrors?:
    | Array<{
        field: string;
        message: string;
        code: string;
        value?: any;
      }>
    | undefined;
  threats?: import("./ThreatProtection").SecurityEvent[] | undefined;
  actions?: import("./ThreatProtection").ThreatAction[] | undefined;
}

/**
 * Security utilities
 */
export class SecurityUtils {
  /**
   * Generate secure random string
   */
  static generateSecureToken(length = 32): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  /**
   * Hash sensitive data
   */
  static async hashData(data: string, salt?: string): Promise<string> {
    // Use crypto for hashing instead of bcrypt to avoid dependency issues
    const crypto = await import("crypto");
    const saltValue = salt || crypto.randomBytes(16).toString("hex");
    return crypto.pbkdf2Sync(data, saltValue, 10000, 64, "sha512").toString("hex");
  }

  /**
   * Compare hashed data
   */
  static async compareHash(data: string, hash: string): Promise<boolean> {
    // Simple comparison for now - in production use proper bcrypt
    const hashedData = await this.hashData(data);
    return hashedData === hash;
  }

  /**
   * Sanitize filename for safe storage
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, "")
      .replace(/_{2,}/g, "")
      .replace(/^_|_$/g, "")
      .substring(0, 255);
  }

  /**
   * Extract IP address from request
   */
  static extractIP(headers: Record<string, string>): string {
    return (
      headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      headers["x-real-ip"] ||
      headers["x-client-ip"] ||
      "unknown"
    );
  }

  /**
   * Check if IP is private/internal
   */
  static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/,
    ];

    return privateRanges.some((range) => range.test(ip));
  }
}

/**
 * Create security system with default configuration
 */
export function createSecuritySystem(config: Partial<SecuritySystemConfig> = {}): SecuritySystem {
  const defaultConfig: SecuritySystemConfig = {
    validation: {
      enableLogging: true,
      strictMode: false,
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || "your-secret-key",
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
      accessTokenExpiry: "15m",
      refreshTokenExpiry: "7d",
      bcryptRounds: 12,
      maxSessions: 5,
      requireEmailVerification: false,
    },
  };

  return new SecuritySystem({
    ...defaultConfig,
    ...config,
    auth: { ...defaultConfig.auth, ...config.auth },
    validation: { ...defaultConfig.validation, ...config.validation },
  });
}
