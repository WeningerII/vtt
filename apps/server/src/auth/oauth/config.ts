/**
 * OAuth Configuration and Strategies
 */

import passport, { type DoneCallback } from "passport";
import { logger } from "@vtt/logging";
import { Strategy as DiscordStrategy } from "passport-discord-auth";
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from "passport-google-oauth20";
import type { VerifyCallback } from "passport-oauth2";
import { AuthManager } from "@vtt/auth";

// Minimal shape used from the Discord OAuth profile. Some community strategies may differ slightly,
// so we keep this interface narrow and resilient to missing fields.
interface DiscordProfile {
  id: string;
  email?: string;
  username?: string;
  global_name?: string;
  avatar?: string;
}

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
    const mapDiscordProfile = (
      profile: DiscordProfile,
      accessToken: string,
      refreshToken: string,
    ): OAuthProfile => {
      const { id, email, username, global_name, avatar } = profile;
      if (!id || !email || !username) {
        throw new Error("Invalid Discord profile data");
      }
      return {
        id,
        provider: "discord",
        email,
        username,
        displayName: global_name || username,
        avatar: avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : undefined,
        accessToken,
        refreshToken,
      };
    };

    const mapGoogleProfile = (
      profile: GoogleProfile,
      accessToken: string,
      refreshToken: string,
    ): OAuthProfile => {
      const email = profile.emails?.[0]?.value;
      if (!profile.id || !profile.displayName || !email) {
        throw new Error("Invalid Google profile data");
      }
      return {
        id: profile.id,
        provider: "google",
        email,
        username: profile.displayName.replace(/\s+/g, "").toLowerCase(),
        displayName: profile.displayName,
        avatar: profile.photos?.[0]?.value,
        accessToken,
        refreshToken,
      };
    };

    const passportDone = (done: VerifyCallback, error: unknown, user?: unknown) => {
      if (error) {
        done(error as Error);
      } else {
        const normalizedUser =
          user && typeof (user as { id?: unknown }).id === "string"
            ? (user as { id: string })
            : false;
        done(null, normalizedUser);
      }
    };

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
          async (
            accessToken: string,
            refreshToken: string,
            profile: DiscordProfile,
            done: VerifyCallback,
          ): Promise<void> => {
            try {
              const oauthProfile = mapDiscordProfile(profile, accessToken, refreshToken);
              const user = await this.handleOAuthLogin(oauthProfile);
              passportDone(done, null, user);
            } catch (error) {
              passportDone(done, error);
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
          async (
            accessToken: string,
            refreshToken: string,
            profile: GoogleProfile,
            done: VerifyCallback,
          ): Promise<void> => {
            try {
              const oauthProfile = mapGoogleProfile(profile, accessToken, refreshToken);
              const user = await this.handleOAuthLogin(oauthProfile);
              passportDone(done, null, user);
            } catch (error) {
              passportDone(done, error);
            }
          },
        ),
      );
    }

    // Serialize/deserialize user for session
    passport.serializeUser((user: unknown, done: DoneCallback) => {
      if (user && typeof (user as { id?: unknown }).id === "string") {
        done(null, (user as { id: string }).id);
      } else {
        done(new Error("Invalid user object"));
      }
    });

    passport.deserializeUser(async (id: string, done: DoneCallback) => {
      try {
        const user = await this.authManager.findUserById(id);
        done(null, user);
      } catch (error) {
        done(error as Error, null);
      }
    });
  }

  private async handleOAuthLogin(oauthProfile: OAuthProfile): Promise<unknown> {
    try {
      // Check if user exists by email (AuthManager currently uses mock DB)
      const existing = await this.authManager.findUserByEmail(oauthProfile.email);
      if (existing) {
        return existing;
      }

      // Create/register a new user via AuthManager
      return await this.createOAuthUser(oauthProfile);
    } catch (error) {
      logger.error("OAuth login handling error:", error);
      throw error;
    }
  }

  private async createOAuthUser(profile: OAuthProfile): Promise<unknown> {
    // Create new user via AuthManager.register (stores user in mock DB for tests)
    const baseUsername = (
      profile.username ||
      profile.email.split("@")[0] ||
      `user_${profile.id.slice(0, 6)}`
    ).toLowerCase();
    const username =
      baseUsername.replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || `user_${profile.id.slice(0, 6)}`;
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
