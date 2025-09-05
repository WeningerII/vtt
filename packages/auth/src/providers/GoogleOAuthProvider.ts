/**
 * Google OAuth 2.0 Provider Implementation
 */
import { OAuth2Client } from 'google-auth-library';
import { UserManager } from '@vtt/user-management';
import { logger } from '@vtt/logging';
import { OAuthStateManager } from '../utils/OAuthStateManager';
import * as crypto from 'crypto';

export interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email_verified: boolean;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOAuthProvider {
  private client: OAuth2Client;
  private userManager: UserManager;
  private config: GoogleOAuthConfig;
  private stateManager?: OAuthStateManager | undefined;
  // private inputValidator: InputValidator; // Temporarily disabled

  constructor(config: GoogleOAuthConfig, userManager: UserManager, stateManager?: OAuthStateManager) {
    this.client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
    this.userManager = userManager;
    this.config = config;
    this.stateManager = stateManager;
    // this.inputValidator = new InputValidator(); // Temporarily disabled
  }

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(userId?: string): Promise<string> {
    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const state = this.stateManager 
      ? await this.stateManager.generateState('google', userId)
      : this.generateState();

    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens and user profile
   */
  async handleCallback(code: string, state?: string): Promise<{
    success: boolean;
    user?: any;
    session?: any;
    error?: string;
  }> {
    try {
      // Validate state parameter for CSRF protection
      if (state) {
        const isValid = this.stateManager 
          ? await this.stateManager.validateState(state, 'google')
          : this.validateState(state);
        
        if (!isValid) {
          return { success: false, error: 'Invalid state parameter' };
        }
      }

      // Exchange code for tokens
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);

      // Get user profile
      const audience = this.config.clientId;
      if (!audience) {
        return { success: false, error: 'Google client ID not configured' };
      }

      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token!,
        audience
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        return { success: false, error: 'Invalid token payload' };
      }

      const googleProfile: GoogleUserProfile = {
        id: payload.sub,
        email: payload.email,
        name: payload.name || '',
        given_name: payload.given_name || '',
        family_name: payload.family_name || '',
        picture: payload.picture || '',
        email_verified: payload.email_verified || false
      };

      // Find or create user  
      const result = await this.findOrCreateUser(googleProfile);
      return result;

    } catch (error) {
      logger.error('Google OAuth callback error:', error as Record<string, any>);
      return { 
        success: false, 
        error: 'Authentication failed' 
      };
    }
  }

  /**
   * Find existing user or create new one from Google profile
   */
  private async findOrCreateUser(profile: GoogleUserProfile): Promise<{
    success: boolean;
    user?: any;
    session?: any;
    error?: string;
  }> {
    try {
      // Check if user exists by email
      let user = this.userManager.findUserByEmail(profile.email);

      if (user) {
        // Update user profile from Google data
        await this.userManager.updateUser(user.id, {
          firstName: profile.given_name,
          lastName: profile.family_name,
          avatarUrl: profile.picture
        });
      } else {
        // Create new user from Google profile
        const baseUsername = (profile.email.split('@')[0] || profile.email)
          .replace(/[^a-zA-Z0-9]/g, '') || 'user';
        let username = baseUsername;
        let counter = 1;
        while (this.userManager.findUserByUsername(username)) {
          username = `${baseUsername}_${counter}`;
          counter++;
        }

        const userData = {
          locale: 'en',
          email: profile.email,
          username,
          password: this.generateSecurePassword(),
          firstName: profile.given_name,
          lastName: profile.family_name
        };

        const result = await this.userManager.createUser(userData);

        if (!result) {
          return { success: false, error: 'Failed to create user account' };
        }

        user = result;
        
        // Update with Google-specific data
        await this.userManager.updateUser(user.id, {
          avatarUrl: profile.picture
        });
      }

      // Create session
      const sessionResult = await this.userManager.createSession(
        user.id,
        {
          userAgent: 'OAuth-Google',
          ip: 'oauth-login',
          platform: 'web',
          browser: 'oauth'
        },
        false
      );

      return {
        success: true,
        user,
        session: sessionResult
      };

    } catch (error) {
      logger.error('Error finding/creating user from Google profile:', error as Record<string, any>);
      return {
        success: false,
        error: 'Failed to process user account'
      };
    }
  }

  /**
   * Generate cryptographically secure state parameter
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate state parameter (basic implementation)
   */
  private validateState(state: string): boolean {
    // Basic validation - in production, store states with expiration
    return Boolean(state && state.length === 64 && /^[a-f0-9]+$/.test(state));
  }

  private generateUsernameFromEmail(email: string): string {
    const baseUsername = email.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'user';
    return `${baseUsername}_${Date.now()}`;
  }

  private generateSecurePassword(): string {
    // Generate a secure random password for OAuth users
    return crypto.randomBytes(16).toString('hex') + Math.random().toString(36).slice(-8);
  }
}
