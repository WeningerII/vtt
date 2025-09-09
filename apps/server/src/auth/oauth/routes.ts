/**
 * OAuth Authentication Routes - Enhanced with comprehensive error handling
 */

import { Router, Request, Response } from "express";
import { logger } from "@vtt/logging";
import { 
  GoogleOAuthProvider, 
  DiscordOAuthProvider, 
  OAuthStateManager, 
  MemoryStateStorage 
} from "@vtt/auth";
import { UserManager } from "@vtt/user-management";

export function createOAuthRoutes(userManager: UserManager): Router {
  const router = Router();

  // Initialize state manager (use Redis in production)
  const stateStorage = new MemoryStateStorage();
  const stateManager = new OAuthStateManager(stateStorage, 10); // 10 minute TTL

  // Initialize OAuth providers with state manager
  const googleProvider = new GoogleOAuthProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/auth/google/callback'
  }, userManager, stateManager);

  const discordProvider = new DiscordOAuthProvider({
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    redirectUri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
    scopes: ['identify', 'email']
  }, userManager, stateManager);

  // Google OAuth initiation
  router.get("/auth/google", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id; // For account linking
      const authUrl = await googleProvider.getAuthorizationUrl(userId);
      res.redirect(authUrl);
    } catch (error) {
      logger.error("Google OAuth initiation error:", error as Record<string, any>);
      res.redirect("/login?error=oauth_init_failed");
    }
  });

  // Google OAuth callback
  router.get("/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;
      const codeStr = String(code || '');
      const stateStr = String(state || '');
      const errorStr = String(error || '');

      if (errorStr) {
        logger.warn("Google OAuth error:", { error: errorStr });
        return res.redirect("/login?error=oauth_cancelled");
      }

      if (!codeStr || !stateStr) {
        return res.redirect("/login?error=oauth_invalid_response");
      }

      // Validate state parameter
      const sessionState = (req.session as any)?.oauthState;
      if (!sessionState || sessionState !== stateStr) {
        logger.warn("OAuth state mismatch - potential CSRF attack");
        return res.redirect("/login?error=oauth_security_error");
      }

      // Process OAuth callback
      const result = await googleProvider.handleCallback(codeStr, stateStr);
      
      if (!result.success) {
        logger.error("Google OAuth callback failed:", { error: result.error });
        return res.redirect(`/login?error=${encodeURIComponent(result.error || 'oauth_failed')}`);
      }

      // Set authentication cookies
      if (result.session) {
        res.cookie("sessionToken", result.session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: result.session.expiresAt.getTime() - Date.now(),
        });

        res.cookie("refreshToken", result.session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }

      // Clear OAuth session data
      delete (req.session as any).oauthState;
      delete (req.session as any).oauthProvider;

      // Redirect to dashboard
      const redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${redirectUrl}/dashboard?welcome=true`);

    } catch (error) {
      logger.error("Google OAuth callback error:", error as Record<string, any>);
      res.redirect("/login?error=oauth_callback_failed");
    }
  });

  // Discord OAuth initiation
  router.get("/auth/discord", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id; // For account linking
      const authUrl = await discordProvider.getAuthorizationUrl(userId);
      res.redirect(authUrl);
    } catch (error) {
      logger.error("Discord OAuth initiation error:", error as Record<string, any>);
      res.redirect("/login?error=oauth_init_failed");
    }
  });

  // Discord OAuth callback
  router.get("/auth/discord/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;
      const codeStr = String(code || '');
      const stateStr = String(state || '');
      const errorStr = String(error || '');

      if (errorStr) {
        logger.warn("Discord OAuth error:", { error: errorStr });
        return res.redirect("/login?error=oauth_cancelled");
      }

      if (!codeStr || !stateStr) {
        return res.redirect("/login?error=oauth_invalid_response");
      }

      // Validate state parameter
      const sessionState = (req.session as any)?.oauthState;
      if (!sessionState || sessionState !== stateStr) {
        logger.warn("OAuth state mismatch - potential CSRF attack");
        return res.redirect("/login?error=oauth_security_error");
      }

      // Process OAuth callback
      const result = await discordProvider.handleCallback(codeStr, stateStr);
      
      if (!result.success) {
        logger.error("Discord OAuth callback failed:", { error: result.error });
        return res.redirect(`/login?error=${encodeURIComponent(result.error || 'oauth_failed')}`);
      }

      // Set authentication cookies
      if (result.session) {
        res.cookie("sessionToken", result.session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: result.session.expiresAt.getTime() - Date.now(),
        });

        res.cookie("refreshToken", result.session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }

      // Clear OAuth session data
      delete (req.session as any).oauthState;
      delete (req.session as any).oauthProvider;

      // Redirect to dashboard
      const redirectUrl = process.env.CLIENT_URL || "http://localhost:3000";
      res.redirect(`${redirectUrl}/dashboard?welcome=true`);

    } catch (error) {
      logger.error("Discord OAuth callback error:", error as Record<string, any>);
      res.redirect("/login?error=oauth_callback_failed");
    }
  });

  // Logout route
  router.post("/auth/logout", (req, res) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }

      res.clearCookie("sessionToken");
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  // Get current user info
  router.get("/auth/me", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = req.user as any;
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        provider: user.provider,
      });
    } catch (error) {
      logger.error("Get user info error:", error as Record<string, any>);
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  // Account linking routes
  router.get("/auth/link/:provider", async (req: Request, res: Response) => {
    const { provider } = req.params;

    if (!req.user) {
      return res.status(401).json({ error: "Must be logged in to link accounts" });
    }

    if (!provider || !["discord", "google"].includes(provider)) {
      return res.status(400).json({ error: "Invalid OAuth provider" });
    }

    // Store linking context in session
    (req.session as any).linkingAccount = true;
    const userId = (req.user as any)?.id;
    if (userId) {
      (req.session as any).currentUserId = userId;
    }

    // Redirect to OAuth provider
    if (provider) {
      res.redirect(`/auth/${provider}`);
    } else {
      res.status(400).json({ error: "Provider parameter is required" });
    }
  });

  // Cleanup expired states periodically
  setInterval(async () => {
    try {
      await stateManager.cleanup();
    } catch (error) {
      logger.error('OAuth state cleanup error:', error as Record<string, any>);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  return router;
}

/**
 * Generate cryptographically secure state parameter (fallback)
 */
function generateSecureState(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}
