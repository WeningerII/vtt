/**
 * Authentication Manager - Core auth functionality
 */
import { compare, hash } from "bcrypt";
import { sign, verify, type SignOptions } from "jsonwebtoken";
import { PrismaClient, type User as PrismaUser } from "@prisma/client";
import { DatabaseManager } from "../database/connection";

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration: string;
  refreshTokenExpiration: string;
  bcryptRounds: number;
  rateLimits?: Record<string, unknown>;
  security?: Record<string, unknown>;
  oauth?: Record<string, unknown>;
}

// Singleton instance
let authManagerInstance: AuthManager | null = null;

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  role: string;
  permissions: string[];
  subscription: string;
  isEmailVerified: boolean;
  lastLogin: string;
}

interface OAuthProfile {
  email: string;
  username?: string;
  displayName?: string;
  avatar?: string;
}

export class AuthManager {
  private prisma: PrismaClient;
  private config: AuthConfig;

  constructor(prisma: PrismaClient, config: AuthConfig) {
    this.prisma = prisma;
    this.config = config;
  }

  async register(data: RegisterData): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existingUser) {
      throw new Error(
        existingUser.email === data.email ? "Email already registered" : "Username already taken",
      );
    }

    // Hash password
    const passwordHash = await hash(data.password, this.config.bcryptRounds);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        displayName: data.displayName,
        passwordHash,
        permissions: [],
        lastLogin: new Date(),
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  async login(data: LoginData): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isValidPassword = await compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Find refresh token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new Error("Invalid or expired refresh token");
    }

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });

    // Generate new tokens
    return this.generateTokens(tokenRecord.userId);
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return user ? this.formatUser(user) : null;
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user ? this.formatUser(user) : null;
  }

  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = verify(token, this.config.jwtSecret) as { userId: string };
      return this.getUserById(payload.userId);
    } catch {
      return null;
    }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  async generateOAuthTokens(oauthUser: OAuthProfile): Promise<AuthTokens> {
    // Find or create user from OAuth data
    let user = await this.prisma.user.findUnique({
      where: { email: oauthUser.email },
    });

    if (!user) {
      // Create new user from OAuth data
      user = await this.prisma.user.create({
        data: {
          email: oauthUser.email,
          username: oauthUser.username || oauthUser.email.split("@")[0],
          displayName: oauthUser.displayName || oauthUser.username || "User",
          avatar: oauthUser.avatar,
          passwordHash: "", // OAuth users don't have passwords
          permissions: [],
          isEmailVerified: true, // OAuth emails are pre-verified
          lastLogin: new Date(),
        },
      });
    } else {
      // Update existing user's last login and avatar
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          avatar: oauthUser.avatar || user.avatar,
        },
      });
    }

    // Generate tokens for the user
    return this.generateTokens(user.id);
  }

  private async generateTokens(userId: string): Promise<AuthTokens> {
    // Generate access token
    const accessToken = sign({ userId }, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiration,
    } as SignOptions);

    // Generate refresh token
    const refreshToken = sign({ userId, type: "refresh" }, this.config.jwtSecret, {
      expiresIn: this.config.refreshTokenExpiration,
    } as SignOptions);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private formatUser(user: PrismaUser): AuthUser {
    const permissions = Array.isArray(user.permissions)
      ? (user.permissions as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [];

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar ?? undefined,
      role: user.role ?? "user",
      permissions,
      subscription: user.subscription ?? "free",
      isEmailVerified: Boolean(user.isEmailVerified),
      lastLogin: (user.lastLogin ?? new Date()).toISOString(),
    };
  }
}

/**
 * Get shared AuthManager instance (singleton pattern)
 */
export function getAuthManager(): AuthManager {
  if (!authManagerInstance) {
    const config: AuthConfig = {
      jwtSecret:
        process.env.JWT_SECRET ||
        process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_REFRESH_SECRET ||
        "dev-secret-change-in-production",
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
        enforcePasswordComplexity: false,
        enableAuditLogging: false,
      },
      oauth: {},
    };

    authManagerInstance = new AuthManager(DatabaseManager.getInstance(), config);
  }

  return authManagerInstance;
}
