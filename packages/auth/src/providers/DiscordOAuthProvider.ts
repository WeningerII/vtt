/**
 * Discord OAuth 2.0 Provider Implementation
 */
import { logger } from '@vtt/logging';
import { UserManager } from '@vtt/user-management';
import { OAuthStateManager } from '../utils/OAuthStateManager';
import * as crypto from 'crypto';

export interface DiscordUserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string;
  verified: boolean;
  flags: number;
  premium_type: number;
  public_flags: number;
}

export interface DiscordOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export class DiscordOAuthProvider {
  private userManager: UserManager;
  private config: DiscordOAuthConfig;
  private stateManager?: OAuthStateManager | undefined;
  private readonly API_BASE = 'https://discord.com/api/v10';
  private readonly OAUTH_BASE = 'https://discord.com/api/oauth2';

  constructor(config: DiscordOAuthConfig, userManager: UserManager, stateManager?: OAuthStateManager) {
    this.config = config;
    this.userManager = userManager;
    this.stateManager = stateManager;
  }

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(userId?: string): Promise<string> {
    const state = this.stateManager 
      ? await this.stateManager.generateState('discord', userId)
      : this.generateState();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token and user profile
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
          ? await this.stateManager.validateState(state, 'discord')
          : this.validateState(state);
        
        if (!isValid) {
          return { success: false, error: 'Invalid state parameter' };
        }
      }

      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code);
      if (!tokenResponse.success) {
        return { success: false, ...(tokenResponse.error && { error: tokenResponse.error }) };
      }

      // Get user profile
      const profileResponse = await this.getUserProfile(tokenResponse.accessToken!);
      if (!profileResponse.success) {
        return { success: false, ...(profileResponse.error && { error: profileResponse.error }) };
      }

      // Find or create user
      const result = await this.findOrCreateUser(profileResponse.profile!);
      return result;

    } catch (error) {
      logger.error('Discord OAuth callback error:', error as Record<string, any>);
      return { 
        success: false, 
        error: 'Authentication failed' 
      };
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.OAUTH_BASE}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Discord token exchange failed:', { status: response.status, error });
        return { success: false, error: 'Token exchange failed' };
      }

      const data = await response.json() as any;
      return {
        success: true,
        accessToken: data.access_token
      };

    } catch (error) {
      logger.error('Discord token exchange error:', error as Record<string, any>);
      return { success: false, error: 'Token exchange failed' };
    }
  }

  /**
   * Get user profile from Discord API
   */
  private async getUserProfile(accessToken: string): Promise<{
    success: boolean;
    profile?: DiscordUserProfile;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/users/@me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Discord profile fetch failed:', { status: response.status, error });
        return { success: false, error: 'Failed to fetch user profile' };
      }

      const profile = await response.json() as DiscordUserProfile;
      return {
        success: true,
        profile
      };

    } catch (error) {
      logger.error('Discord profile fetch error:', error as Record<string, any>);
      return { success: false, error: 'Failed to fetch user profile' };
    }
  }

  /**
   * Find existing user or create new one from Discord profile
   */
  private async findOrCreateUser(profile: DiscordUserProfile): Promise<{
    success: boolean;
    user?: any;
    session?: any;
    error?: string;
  }> {
    try {
      // Check if user exists by email
      let user = this.userManager.findUserByEmail(profile.email);

      if (user) {
        // Update user profile from Discord data
        await this.userManager.updateUser(user.id, {
          firstName: profile.username,
          avatarUrl: profile.avatar 
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(profile.discriminator) % 5}.png`
        });

        // Note: We cannot directly mark email verified here because UserManager.verifyEmail
        // expects a verification token, not a user ID. We rely on the existing verification
        // flow or configuration that may not require email verification for OAuth users.
      } else {
        // Generate unique username from Discord username
        const baseUsername = profile.username.replace(/[^a-zA-Z0-9]/g, '');
        let username = baseUsername;
        let counter = 1;
        
        // Ensure username is unique
        while (this.userManager.findUserByUsername(username)) {
          username = `${baseUsername}_${counter}`;
          counter++;
        }

        // Create new user from Discord profile
        const result = await this.userManager.createUser({
          locale: 'en',
          email: profile.email,
          username: username,
          password: this.generateSecurePassword(), // Generate random password
          firstName: profile.username
        });

        if (!result) {
          return { success: false, error: 'Failed to create user' };
        }

        user = result;
        
        // Update with Discord-specific data
        await this.userManager.updateUser(user.id, {
          avatarUrl: profile.avatar 
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(profile.discriminator) % 5}.png`
        });
      }

      // Create session
      const session = await this.userManager.createSession(
        user.id,
        {
          userAgent: 'OAuth-Discord',
          ip: 'oauth-login',
          platform: 'web',
          browser: 'oauth'
        },
        false
      );

      return {
        success: true,
        user,
        session
      };

    } catch (error) {
      logger.error('Error finding/creating user from Discord profile:', error as Record<string, any>);
      return {
        success: false,
        error: 'Failed to process user account'
      };
    }
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private validateState(state: string): boolean {
    // In production, store states in Redis/database with expiration
    // For now, basic validation
    return state.length > 10 && /^[a-zA-Z0-9]+$/.test(state);
  }

  private generateSecurePassword(): string {
    // Generate a secure random password for OAuth users
    return Math.random().toString(36).slice(-12) + 
           Math.random().toString(36).slice(-12);
  }
}
