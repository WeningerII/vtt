/**
 * Unified Authentication Strategy
 * Consolidates cookie-based and token-based authentication patterns
 */

import { RouteHandler, Context, AuthenticatedRequest } from "../router/types";
import { logger } from "@vtt/logging";
import { AuthManager } from "@vtt/auth";
import { _serverConfig } from "../config/environment";
import type { ServerResponse } from "http";

// Singleton auth manager with proper configuration
let authManagerInstance: AuthManager | null = null;

function getAuthManager(): AuthManager {
  if (!authManagerInstance) {
    authManagerInstance = new AuthManager({
      jwtSecret: _serverConfig.jwtSecret,
      jwtExpiration: "7d",
      refreshTokenExpiration: "30d",
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
        requireEmailVerification: false,
        allowGuestAccess: true,
        enforcePasswordComplexity: true,
        enableAuditLogging: true,
      },
      oauth: {},
    });
  }
  return authManagerInstance;
}

/**
 * Unified authentication middleware that handles both cookie and bearer token auth
 */
export const unifiedAuth: RouteHandler = async (ctx) => {
  try {
    const authManager = getAuthManager();

    // Extract token from multiple sources (priority order)
    const token = extractAuthToken(ctx.req);

    if (!token) {
      respondUnauthorized(ctx.res, "Authentication required");
      return;
    }

    // Validate token
    const securityContext = await authManager.validateToken(
      token.value,
      getClientIP(ctx.req),
      ctx.req.headers["user-agent"] || "unknown",
    );

    if (!securityContext) {
      respondUnauthorized(ctx.res, "Invalid or expired token");
      return;
    }

    // Attach user context
    (ctx.req as any).user = securityContext.user;
    (ctx.req as any).session = securityContext.session;
    (ctx.req as any).authMethod = token.source;
  } catch (error) {
    logger.error("Unified auth middleware error:", error as Error);
    respondUnauthorized(ctx.res, "Authentication failed");
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalUnifiedAuth: RouteHandler = async (ctx) => {
  try {
    const authManager = getAuthManager();
    const token = extractAuthToken(ctx.req);

    if (token) {
      try {
        const securityContext = await authManager.validateToken(
          token.value,
          getClientIP(ctx.req),
          ctx.req.headers["user-agent"] || "unknown",
        );

        if (securityContext) {
          (ctx.req as any).user = securityContext.user;
          (ctx.req as any).session = securityContext.session;
          (ctx.req as any).authMethod = token.source;
        }
      } catch (error) {
        logger.debug("Optional auth token validation failed:", error as Error);
      }
    }
  } catch (error) {
    logger.debug("Optional unified auth failed:", error as Error);
  }
};

/**
 * Extract authentication token from request with priority:
 * 1. Authorization Bearer header
 * 2. sessionToken cookie
 * 3. access_token query parameter (for WebSocket upgrades)
 */
function extractAuthToken(req: AuthenticatedRequest): { value: string; source: string } | null {
  // Check Authorization header first (most secure)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return {
      value: authHeader.slice(7),
      source: "bearer",
    };
  }

  // Check cookies
  const cookies = parseCookies(req.headers.cookie || "");
  if (cookies.sessionToken) {
    return {
      value: cookies.sessionToken,
      source: "cookie",
    };
  }

  // Check query parameters (for WebSocket connections)
  if (req.url) {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const queryToken = url.searchParams.get("access_token");
    if (queryToken) {
      return {
        value: queryToken,
        source: "query",
      };
    }
  }

  return null;
}

/**
 * Get client IP address with proxy support
 */
function getClientIP(req: AuthenticatedRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (forwardedIp) {
    return forwardedIp.split(",")[0];
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) {
    return realIp;
  }

  return (
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

/**
 * Parse cookie string into key-value pairs
 */
function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieStr.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
}

/**
 * Send standardized unauthorized response
 */
function respondUnauthorized(res: ServerResponse, message: string): void {
  res.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": 'Bearer realm="VTT API"',
  });
  res.end(
    JSON.stringify({
      error: "Unauthorized",
      message,
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Helper to get authenticated user from context
 */
export function getAuthenticatedUser(ctx: Context): Context["req"]["user"] | null {
  return ctx.req.user || null;
}

/**
 * Helper to get authenticated user ID from context
 */
export function getAuthenticatedUserId(ctx: Context): string {
  const user = getAuthenticatedUser(ctx);
  if (!user?.id) {
    throw new Error("Authentication required - no authenticated user found");
  }
  return user.id;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(ctx: Context, permission: string): boolean {
  const user = getAuthenticatedUser(ctx);
  return user?.role === "admin" || user?.permissions?.includes(permission as any) || false;
}

/**
 * Require specific permission middleware
 */
export function requirePermission(permission: string): RouteHandler {
  return async (ctx) => {
    if (!hasPermission(ctx, permission)) {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(
        JSON.stringify({
          error: "Forbidden",
          message: `Permission required: ${permission}`,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  };
}

/**
 * Require admin role middleware
 */
export const requireAdmin: RouteHandler = async (ctx) => {
  const user = getAuthenticatedUser(ctx);

  if (user?.role !== "admin") {
    ctx.res.writeHead(403, { "Content-Type": "application/json" });
    ctx.res.end(
      JSON.stringify({
        error: "Forbidden",
        message: "Admin access required",
        timestamp: new Date().toISOString(),
      }),
    );
  }
};
