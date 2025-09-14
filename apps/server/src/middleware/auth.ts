/**
 * Authentication middleware for API routes
 */

import { RouteHandler, Middleware } from "../router/types";
import { logger } from "@vtt/logging";
import { getAuthManager } from "../auth/auth-manager";

// Use shared AuthManager instance
const authManager = getAuthManager();

/**
 * Middleware to require authentication for protected routes
 */
export const requireAuth: Middleware = async (ctx, next) => {
  try {
    // Check for session token in cookies
    const cookies = parseCookies(ctx.req.headers.cookie || "");
    const sessionToken = cookies.sessionToken;

    // Check for Authorization header as fallback
    const authHeader = ctx.req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const token = sessionToken || bearerToken;

    if (!token) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    // Verify JWT token
    const user = await authManager.verifyAccessToken(token);

    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Invalid or expired token" }));
      return;
    }

    // Add user info to request context
    (ctx.req as any).user = user;
    (ctx.req as any).session = { token };

    // Call next middleware/handler - THIS IS CRITICAL!
    await next();
  } catch (error) {
    logger.error("Auth middleware error:", error as Error);
    ctx.res.writeHead(401, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Authentication failed" }));
  }
};

/**
 * Middleware to require specific permissions
 */
export function requirePermission(_permission: string): Middleware {
  return async (ctx, next) => {
    const user = (ctx.req as any).user;

    if (!user) {
      ctx.res.writeHead(401, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Authentication required" }));
      return;
    }

    if (!user.permissions?.includes(_permission) && user.role !== "admin") {
      ctx.res.writeHead(403, { "Content-Type": "application/json" });
      ctx.res.end(JSON.stringify({ error: "Insufficient permissions" }));
      return;
    }

    // Call next middleware/handler
    await next();
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin: Middleware = async (ctx, next) => {
  const user = (ctx.req as any).user;

  if (!user) {
    ctx.res.writeHead(401, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Authentication required" }));
    return;
  }

  if (user.role !== "admin") {
    ctx.res.writeHead(403, { "Content-Type": "application/json" });
    ctx.res.end(JSON.stringify({ error: "Admin access required" }));
    return;
  }

  // Call next middleware/handler
  await next();
};

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
export const optionalAuth: Middleware = async (ctx, next) => {
  try {
    const cookies = parseCookies(ctx.req.headers.cookie || "");
    const sessionToken = cookies.sessionToken;

    const authHeader = ctx.req.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const token = sessionToken || bearerToken;

    if (token) {
      try {
        const user = await authManager.verifyAccessToken(token);
        if (user) {
          (ctx.req as any).user = user;
          (ctx.req as any).session = { token };
        }
      } catch (_error) {
        // Ignore errors for optional auth
      }
    }

    // Always call next for optional auth
    await next();
  } catch (error) {
    // Silently fail for optional auth
    logger.warn("Optional auth failed:", error as Error);
    // Still call next even on error
    await next();
  }
};

/**
 * Helper function to get authenticated user ID from context
 */
export function getAuthenticatedUserId(ctx: unknown): string {
  const user = ctx.req.user;
  if (!user) {
    throw new Error("Authentication required - no authenticated user found");
  }
  return user.id;
}

/**
 * Helper function to get authenticated user from context (optional)
 */
export function getAuthenticatedUser(ctx: unknown): any | null {
  return ctx.req.user || null;
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
