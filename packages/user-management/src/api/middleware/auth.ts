/**
 * Authentication middleware for API routes
 */
import { Request, Response, NextFunction } from "express";
import { logger } from "@vtt/logging";
import { UserManager } from "../../UserManager";

export interface AuthenticatedRequest extends Request {
  user?: any;
  session?: any;
}

/**
 * Middleware to authenticate users via session token
 */
export function authenticateUser(userManager: UserManager) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get token from cookie or Authorization header
      const token =
        req.cookies.sessionToken ||
        (req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.substring(7)
          : null);

      if (!token) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Validate session
      const result = await userManager.validateSession(token);

      if (!result.success || !result.user || !result.session) {
        res.status(401).json({ error: "Invalid or expired session" });
        return;
      }

      // Check if user is active
      if (result.user.status !== "active") {
        res.status(403).json({ error: "Account is suspended or inactive" });
        return;
      }

      // Attach user and session to request
      req.user = result.user;
      req.session = result.session;

      // Update last activity
      await userManager.updateUserActivity(result.user.id);

      next();
    } catch (error) {
      logger.error("Authentication middleware error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Middleware to require specific user roles
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

/**
 * Middleware to require email verification
 */
export function requireEmailVerification() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        error: "Email verification required",
        code: "EMAIL_VERIFICATION_REQUIRED",
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check subscription requirements
 */
export function requireSubscription(_minTier?: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Check if user has active subscription
    if (!user.subscription || user.subscription.status !== "active") {
      res.status(403).json({
        error: "Active subscription required",
        code: "SUBSCRIPTION_REQUIRED",
      });
      return;
    }

    // Check minimum tier if specified
    if (minTier) {
      const tierLevels = {
        free: 0,
        basic: 1,
        premium: 2,
        enterprise: 3,
      };

      const userTierLevel = tierLevels[user.subscription.tier as keyof typeof tierLevels] || 0;
      const requiredTierLevel = tierLevels[minTier as keyof typeof tierLevels] || 0;

      if (userTierLevel < requiredTierLevel) {
        res.status(403).json({
          error: `${minTier} subscription or higher required`,
          code: "INSUFFICIENT_SUBSCRIPTION_TIER",
        });
        return;
      }
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no auth provided
 */
export function optionalAuth(userManager: UserManager) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token =
        req.cookies.sessionToken ||
        (req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.substring(7)
          : null);

      if (token) {
        const result = await userManager.validateSession(token);

        if (result.success && result.user && result.session) {
          req.user = result.user;
          req.session = result.session;
          await userManager.updateUserActivity(result.user.id);
        }
      }

      next();
    } catch (_error) {
      // Don't fail on optional auth errors
      next();
    }
  };
}
