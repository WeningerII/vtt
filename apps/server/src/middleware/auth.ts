/**
 * Authentication middleware for API routes
 */

import { RouteHandler, Middleware } from '../router/types';
import { logger } from '@vtt/logging';
import { AuthManager } from '@vtt/auth';

const authManager = new AuthManager({
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  jwtExpiration: '7d',
  refreshTokenExpiration: '30d',
  bcryptRounds: 12,
  rateLimits: {
    login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    register: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
    passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
    general: { windowMs: 15 * 60 * 1000, maxRequests: 100 }
  },
  security: {
    requireTwoFactor: false,
    sessionTimeout: 60,
    maxFailedAttempts: 5,
    lockoutDuration: 15,
    requireEmailVerification: false,
    allowGuestAccess: true,
    enforcePasswordComplexity: false,
    enableAuditLogging: false
  },
  oauth: {}
});

/**
 * Middleware to require authentication for protected routes
 */
export const requireAuth: Middleware = async (ctx, next) => {
  try {
    // Check for session token in cookies
    const cookies = parseCookies(ctx.req.headers.cookie || '');
    const sessionToken = cookies.sessionToken;
    
    // Check for Authorization header as fallback
    const authHeader = ctx.req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    const token = sessionToken || bearerToken;
    
    if (!token) {
      ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    // Verify JWT token
    const securityContext = await authManager.validateToken(token, 
      ctx.req.socket.remoteAddress || 'unknown', 
      ctx.req.headers['user-agent'] || 'unknown'
    );
    
    if (!securityContext) {
      ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Invalid or expired token' }));
      return;
    }

    // Add user info to request context
    (ctx.req as any).user = securityContext.user;
    (ctx.req as any).session = securityContext.session;
    
    // Call next middleware/handler - THIS IS CRITICAL!
    await next();

  } catch (error) {
    logger.error('Auth middleware error:', error as Error);
    ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Authentication failed' }));
  }
};

/**
 * Middleware to require specific permissions
 */
export function requirePermission(_permission: string): Middleware {
  return async (ctx, next) => {
    const user = (ctx.req as any).user;
    
    if (!user) {
      ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    if (!user.permissions?.includes(_permission) && user.role !== 'admin') {
      ctx.res.writeHead(403, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Insufficient permissions' }));
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
    ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  if (user.role !== 'admin') {
    ctx.res.writeHead(403, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({ error: 'Admin access required' }));
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
    const cookies = parseCookies(ctx.req.headers.cookie || '');
    const sessionToken = cookies.sessionToken;
    
    const authHeader = ctx.req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    const token = sessionToken || bearerToken;
    
    if (token) {
      try {
        const securityContext = await authManager.validateToken(token,
          ctx.req.socket.remoteAddress || 'unknown',
          ctx.req.headers['user-agent'] || 'unknown'
        );
        if (securityContext) {
          (ctx.req as any).user = securityContext.user;
          (ctx.req as any).session = securityContext.session;
        }
      } catch (_error) {
        // Ignore errors for optional auth
      }
    }
    
    // Always call next for optional auth
    await next();
  } catch (error) {
    // Silently fail for optional auth
    logger.warn('Optional auth failed:', error as Error);
    // Still call next even on error
    await next();
  }
};

/**
 * Helper function to get authenticated user ID from context
 */
export function getAuthenticatedUserId(ctx: any): string {
  const user = ctx.req.user;
  if (!user) {
    throw new Error('Authentication required - no authenticated user found');
  }
  return user.id;
}

/**
 * Helper function to get authenticated user from context (optional)
 */
export function getAuthenticatedUser(ctx: any): any | null {
  return ctx.req.user || null;
}

/**
 * Parse cookie string into key-value pairs
 */
function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  cookieStr.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}
