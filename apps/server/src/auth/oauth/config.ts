/**
 * OAuth Configuration and Strategies
 */

import passport from "passport";
import { logger } from "@vtt/logging";
import { Strategy as DiscordStrategy } from "passport-discord";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { AuthManager } from "@vtt/auth";

// Note: This server uses the in-memory AuthManager for OAuth user handling during tests.
// We intentionally avoid direct Prisma usage here to prevent schema mismatches and runtime issues.

export interface OAuthProfile {
  id: string;
  provider: "discord" | "google";
  email: string;
  username: string;
  displayName: string;
  avatar?: string | undefined;
  accessToken: string;
  refreshToken?: string;
}

export interface OAuthConfig {
  discord: {
    clientId: string;
    clientSecret: string;
    callbackURL: string;
    scope: string[];
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackURL: string;
    scope: string[];
  };
}

export class OAuthManager {
  private authManager: AuthManager;
  private config: OAuthConfig;

  constructor(authManager: AuthManager, config: OAuthConfig) {
    this.authManager = authManager;
    this.config = config;
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Discord OAuth Strategy - only initialize if credentials are provided
    if (this.config.discord.clientId && this.config.discord.clientSecret) {
      passport.use(
        "discord",
        new DiscordStrategy(
          {
            clientID: this.config.discord.clientId,
            clientSecret: this.config.discord.clientSecret,
            callbackURL: this.config.discord.callbackURL,
            scope: this.config.discord.scope,
          },
          async (accessToken: string, refreshToken: string, profile: any, done: any) => {
            try {
              const oauthProfile: OAuthProfile = {
                id: profile.id,
                provider: "discord",
                email: profile.email,
                username: profile.username,
                displayName: profile.global_name || profile.username,
                avatar: profile.avatar
                  ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                  : undefined,
                accessToken,
                refreshToken,
              };

              const user = await this.handleOAuthLogin(oauthProfile);
              return done(null, user);
            } catch (error) {
              return done(error, null);
            }
          },
        ),
      );
    }

    // Google OAuth Strategy - only initialize if credentials are provided
    if (this.config.google.clientId && this.config.google.clientSecret) {
      passport.use(
        "google",
        new GoogleStrategy(
          {
            clientID: this.config.google.clientId,
            clientSecret: this.config.google.clientSecret,
            callbackURL: this.config.google.callbackURL,
            scope: this.config.google.scope,
          },
          async (accessToken: string, refreshToken: string, profile: any, done: any) => {
            try {
              const oauthProfile: OAuthProfile = {
                id: profile.id,
                provider: "google",
                email: profile.emails?.[0]?.value || "",
                username: profile.displayName.replace(/\s+/g, "").toLowerCase(),
                displayName: profile.displayName,
                avatar: profile.photos?.[0]?.value,
                accessToken,
                refreshToken,
              };

              const user = await this.handleOAuthLogin(oauthProfile);
              return done(null, user);
            } catch (error) {
              return done(error, null);
            }
          },
        ),
      );
    }

    // Serialize/deserialize user for session
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done: any) => {
      try {
        const user = await this.authManager.findUserById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  private async handleOAuthLogin(oauthProfile: OAuthProfile): Promise<any> {
    try {
      // Check if user exists by email (AuthManager currently uses mock DB)
      const existing = await this.authManager.findUserByEmail(oauthProfile.email);
      if (existing) {
        return existing;
      }

      // Create/register a new user via AuthManager
      return await this.createOAuthUser(oauthProfile);
    } catch (error) {
      logger.error("OAuth login handling error:", error as any);
      throw error;
    }
  }

  private async createOAuthUser(profile: OAuthProfile): Promise<any> {
    // Create new user via AuthManager.register (stores user in mock DB for tests)
    const baseUsername = (
      profile.username ||
      profile.email.split("@")[0] ||
      `user_${profile.id.slice(0, 6)}`
    ).toLowerCase();
    const username =
      baseUsername.replace(/[^a-z0-9_\-]/gi, "").slice(0, 20) || `user_${profile.id.slice(0, 6)}`;
    const displayName = profile.displayName || baseUsername;
    // Strong password to satisfy complexity when enabled
    const password = `OAuth!${profile.provider}A1_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;

    const user = await this.authManager.register({
      email: profile.email,
      username,
      password,
      displayName,
      acceptTerms: true,
    });

    logger.info(`Created new OAuth user from ${profile.provider}`);
    return user;
  }
}

export function createOAuthConfig(): OAuthConfig {
  return {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      callbackURL: process.env.DISCORD_CALLBACK_URL || "/auth/discord/callback",
      scope: ["identify", "email"],
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      scope: ["profile", "email"],
    },
  };
}
