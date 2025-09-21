/**
 * VTT Authentication and Authorization Package
 */

// Core managers
export { AuthManager } from "./AuthManager";
export { SecurityMiddleware } from "./SecurityMiddleware";
export { AuthorizationManager } from "./AuthorizationManager";
export * from "./SecurityUtils";

// OAuth providers
export {
  GoogleOAuthProvider,
  GoogleUserProfile,
  type GoogleOAuthConfig,
} from "./providers/GoogleOAuthProvider";
export {
  DiscordOAuthProvider,
  DiscordOAuthConfig,
  DiscordUserProfile,
} from "./providers/DiscordOAuthProvider";

// OAuth state management
export {
  OAuthStateManager,
  MemoryStateStorage,
  RedisStateStorage,
  type OAuthState,
  type StateStorage,
} from "./utils/OAuthStateManager";

// Auth configuration will be provided by consumers

// Types and interfaces
export * from "./types";

/**
 * Create and configure the complete authentication system
 */
import { AuthManager } from "./AuthManager";
import { AuthorizationManager } from "./AuthorizationManager";
import { SecurityMiddleware } from "./SecurityMiddleware";

export function createAuthSystem(config: import("./types").AuthConfig) {
  const authManager = new AuthManager(config);
  const authzManager = new AuthorizationManager();
  const securityMiddleware = new SecurityMiddleware(authManager, authzManager, config.security);

  return {
    authManager,
    authzManager,
    securityMiddleware,

    // Convenience methods
    authenticate: securityMiddleware.authenticate.bind(securityMiddleware),
    authorize: securityMiddleware.authorize.bind(securityMiddleware),
    rateLimit: securityMiddleware.rateLimit.bind(securityMiddleware),
    securityHeaders: securityMiddleware.securityHeaders.bind(securityMiddleware),
    cors: securityMiddleware.cors.bind(securityMiddleware),
    secureWebSocket: securityMiddleware.secureWebSocket.bind(securityMiddleware),
  };
}

/**
 * Default configuration factory
 */
export function createDefaultAuthConfig(): import("./types").AuthConfig {
  return {
    jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
    jwtExpiration: "1h",
    refreshTokenExpiration: "30d",
    bcryptRounds: 12,
    rateLimits: {
      login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        skipSuccessfulRequests: true,
      },
      register: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        skipSuccessfulRequests: true,
      },
      passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        skipSuccessfulRequests: true,
      },
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
      },
    },
    security: {
      requireTwoFactor: false,
      sessionTimeout: 24 * 60, // 24 hours in minutes
      maxFailedAttempts: 5,
      lockoutDuration: 30, // 30 minutes
      requireEmailVerification: true,
      allowGuestAccess: true,
      enforcePasswordComplexity: true,
      enableAuditLogging: true,
    },
    oauth: {
      // OAuth configurations would be added here
    },
  };
}
