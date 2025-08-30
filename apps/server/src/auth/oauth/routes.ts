/**
 * OAuth Authentication Routes
 */

import { Router } from 'express';
import { logger } from '@vtt/logging';
import passport from 'passport';
import { AuthManager } from '@vtt/auth';

export function createOAuthRoutes(authManager: AuthManager): Router {
  const router = Router();

  // Discord OAuth routes
  router.get('/auth/discord', 
    passport.authenticate('discord', { scope: ['identify', 'email'] })
  );

  router.get('/auth/discord/callback',
    passport.authenticate('discord', { 
      failureRedirect: '/login?error=discord_auth_failed',
      session: true
    }),
    async (req, res) => {
      try {
        // Generate JWT for authenticated user
        const user = req.user as any;
        const tokens = await authManager.generateOAuthTokens(user);
        
        // Set secure HTTP-only cookie
        res.cookie('sessionToken', tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to client app
        const redirectUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        res.redirect(`${redirectUrl}/dashboard`);
      } catch (error) {
        logger.error('Discord OAuth callback error:', error as any);
        res.redirect('/login?error=auth_callback_failed');
      }
    }
  );

  // Google OAuth routes
  router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get('/auth/google/callback',
    passport.authenticate('google', {
      failureRedirect: '/login?error=google_auth_failed',
      session: true
    }),
    async (req, res) => {
      try {
        // Generate JWT for authenticated user
        const user = req.user as any;
        const tokens = await authManager.generateOAuthTokens(user);
        
        // Set secure HTTP-only cookie
        res.cookie('sessionToken', tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to client app
        const redirectUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        res.redirect(`${redirectUrl}/dashboard`);
      } catch (error) {
        logger.error('Google OAuth callback error:', error as any);
        res.redirect('/login?error=auth_callback_failed');
      }
    }
  );

  // Logout route
  router.post('/auth/logout', (req, res) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      res.clearCookie('sessionToken');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });

  // Get current user info
  router.get('/auth/me', async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const user = req.user as any;
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        provider: user.provider
      });
    } catch (error) {
      logger.error('Get user info error:', error as any);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  // Link additional OAuth account
  router.get('/auth/link/:provider', (req, res, next) => {
    const { provider  } = req.params;
    
    if (!req.user) {
      return res.status(401).json({ error: 'Must be logged in to link accounts' });
    }

    if (!['discord', 'google'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid OAuth provider' });
    }

    // Store state to indicate this is an account linking flow
    (req as any).session.linkingAccount = true;
    
    passport.authenticate(provider)(req, res, next);
  });

  return router;
}
