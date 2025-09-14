/**
 * Auth module exports
 */

import { AuthManager, AuthConfig } from "@vtt/auth";
import { OAuthManager, createOAuthConfig } from "./oauth/config";
import { createOAuthRoutes } from "./oauth/routes";

// Create auth configuration
export function createAuthConfig(): AuthConfig {
  return {
    jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    jwtExpiration: "1h",
    refreshTokenExpiration: "7d",
    bcryptRounds: 12,
    rateLimits: {
      login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
      register: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
      passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
      general: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
    },
    security: {
      requireTwoFactor: false,
      sessionTimeout: 60,
      maxFailedAttempts: 5,
      lockoutDuration: 15,
      requireEmailVerification: true,
      allowGuestAccess: true,
      enforcePasswordComplexity: true,
      enableAuditLogging: true,
    },
    oauth: {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID || "",
        clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
        redirectUri: process.env.DISCORD_CALLBACK_URL || "/auth/discord/callback",
        scopes: ["identify", "email"],
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirectUri: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
        scopes: ["profile", "email"],
      },
    },
  };
}

// Initialize auth system
export function initializeAuth() {
  const authConfig = createAuthConfig();
  const authManager = new AuthManager(authConfig);
  const oauthConfig = createOAuthConfig();
  const oauthManager = new OAuthManager(authManager, oauthConfig);
  // Temporarily pass authManager as UserManager - needs proper UserManager implementation
  // TODO: Implement proper UserManager interface
  const oauthRoutes = createOAuthRoutes(authManager as any);

  return {
    authManager,
    oauthManager,
    oauthRoutes,
  };
}
