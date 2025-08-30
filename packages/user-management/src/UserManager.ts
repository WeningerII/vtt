/**
 * Comprehensive user account management system
 */

import { EventEmitter } from "events";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  timezone?: string;
  locale: string;

  // Account status
  status: "active" | "inactive" | "suspended" | "pending_verification";
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;

  // Subscription info
  subscriptionId?: string;
  subscriptionStatus?: "active" | "cancelled" | "past_due" | "trialing";
  subscriptionTier: "free" | "basic" | "premium" | "enterprise";
  subscriptionExpiresAt?: Date;

  // Preferences
  preferences: {
    theme: "light" | "dark" | "auto";
    notifications: {
      email: boolean;
      push: boolean;
      gameInvites: boolean;
      updates: boolean;
    };
    privacy: {
      profileVisible: boolean;
      showOnlineStatus: boolean;
      allowFriendRequests: boolean;
    };
  };

  // Metadata
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;

  // Gaming profile
  gamesPlayed: number;
  gamesHosted: number;
  hoursPlayed: number;
  achievements: string[];

  // Social
  friends: string[];
  blockedUsers: string[];

  // Limits based on subscription
  limits: {
    maxCampaigns: number;
    maxPlayersPerGame: number;
    maxStorageGB: number;
    maxAssets: number;
    canUseCustomAssets: boolean;
    canUseAdvancedFeatures: boolean;
  };
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    platform: string;
    browser: string;
  };
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface LoginAttempt {
  id: string;
  email: string;
  ip: string;
  success: boolean;
  failureReason?: string;
  timestamp: Date;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface EmailVerification {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

export interface UserManagerConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  passwordResetExpiresIn: number;
  emailVerificationExpiresIn: number;
  sessionTimeout: number;
  requireEmailVerification: boolean;
  enableTwoFactor: boolean;
}

// Validation schemas
const CreateUserSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(128),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().default("en-US"),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  remember: z.boolean().default(false),
  deviceInfo: z.object({
    userAgent: z.string(),
    ip: z.string(),
    platform: z.string().optional(),
    browser: z.string().optional(),
  }),
});

const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  preferences: z
    .object({
      theme: z.enum(["light", "dark", "auto"]).optional(),
      notifications: z
        .object({
          email: z.boolean().optional(),
          push: z.boolean().optional(),
          gameInvites: z.boolean().optional(),
          updates: z.boolean().optional(),
        })
        .optional(),
      privacy: z
        .object({
          profileVisible: z.boolean().optional(),
          showOnlineStatus: z.boolean().optional(),
          allowFriendRequests: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

export class UserManager extends EventEmitter {
  private config: UserManagerConfig;
  private users = new Map<string, User>();
  private sessions = new Map<string, Session>();
  private loginAttempts = new Map<string, LoginAttempt[]>();
  private passwordResets = new Map<string, PasswordResetRequest>();
  private emailVerifications = new Map<string, EmailVerification>();

  constructor(config: UserManagerConfig) {
    super();
    this.config = config;
  }

  // User registration
  async createUser(data: z.infer<typeof CreateUserSchema>): Promise<User> {
    const validated = CreateUserSchema.parse(data);

    // Check if user already exists
    const existingUser =
      this.findUserByEmail(validated.email) || this.findUserByUsername(validated.username);
    if (existingUser) {
      throw new Error("User already exists with this email or username");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, this.config.bcryptRounds);

    // Create user
    const user: User = {
      id: uuidv4(),
      email: validated.email,
      username: validated.username,
      passwordHash,
      firstName: validated.firstName,
      lastName: validated.lastName,
      timezone: validated.timezone,
      locale: validated.locale,

      status: this.config.requireEmailVerification ? "pending_verification" : "active",
      emailVerified: !this.config.requireEmailVerification,
      phoneVerified: false,
      twoFactorEnabled: false,

      subscriptionTier: "free",

      preferences: {
        theme: "auto",
        notifications: {
          email: true,
          push: true,
          gameInvites: true,
          updates: false,
        },
        privacy: {
          profileVisible: true,
          showOnlineStatus: true,
          allowFriendRequests: true,
        },
      },

      loginCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),

      gamesPlayed: 0,
      gamesHosted: 0,
      hoursPlayed: 0,
      achievements: [],

      friends: [],
      blockedUsers: [],

      limits: this.getSubscriptionLimits("free"),
    };

    this.users.set(user.id, user);

    // Send email verification if required
    if (this.config.requireEmailVerification) {
      await this.sendEmailVerification(user.id);
    }

    this.emit("userCreated", user);
    return user;
  }

  // Authentication
  async authenticateUser(
    data: z.infer<typeof LoginSchema>,
  ): Promise<{ user: User; session: Session }> {
    const validated = LoginSchema.parse(data);

    // Check rate limiting
    await this.checkRateLimit(validated.email, validated.deviceInfo.ip);

    const user = this.findUserByEmail(validated.email);
    if (!user) {
      await this.recordLoginAttempt(
        validated.email,
        validated.deviceInfo.ip,
        false,
        "User not found",
      );
      throw new Error("Invalid credentials");
    }

    // Verify password
    const passwordValid = await bcrypt.compare(validated.password, user.passwordHash);
    if (!passwordValid) {
      await this.recordLoginAttempt(
        validated.email,
        validated.deviceInfo.ip,
        false,
        "Invalid password",
      );
      throw new Error("Invalid credentials");
    }

    // Check user status
    if (user.status === "suspended") {
      throw new Error("Account suspended");
    }

    if (user.status === "pending_verification") {
      throw new Error("Email verification required");
    }

    // Create session
    const session = await this.createSession(user.id, validated.deviceInfo, validated.remember);

    // Update user login info
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    user.loginCount++;
    user.updatedAt = new Date();

    await this.recordLoginAttempt(validated.email, validated.deviceInfo.ip, true);
    this.emit("userLoggedIn", user, session);

    return { user, session };
  }

  // Session management
  async createSession(
    userId: string,
    deviceInfo: any,
    remember: boolean = false,
  ): Promise<Session> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const sessionId = uuidv4();
    const token = jwt.sign({ userId, sessionId }, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    });

    const refreshToken = jwt.sign({ userId, sessionId, type: "refresh" }, this.config.jwtSecret, {
      expiresIn: this.config.refreshTokenExpiresIn,
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + (remember ? 30 * 24 * 60 * 60 : this.config.sessionTimeout),
    );

    const session: Session = {
      id: sessionId,
      userId,
      token,
      refreshToken,
      deviceInfo,
      expiresAt,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.emit("sessionCreated", session);

    return session;
  }

  async validateSession(token: string): Promise<{ user: User; session: Session } | null> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      const session = this.sessions.get(decoded.sessionId);

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      const user = this.users.get(session.userId);
      if (!user || user.status !== "active") {
        return null;
      }

      // Update last used time
      session.lastUsedAt = new Date();
      user.lastActiveAt = new Date();

      return { user, session };
    } catch (_error) {
      return null;
    }
  }

  async refreshSession(refreshToken: string): Promise<Session> {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as any;

      if (decoded.type !== "refresh") {
        throw new Error("Invalid refresh token");
      }

      const session = this.sessions.get(decoded.sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      const user = this.users.get(session.userId);
      if (!user || user.status !== "active") {
        throw new Error("User not active");
      }

      // Create new tokens
      const newToken = jwt.sign({ userId: user.id, sessionId: session.id }, this.config.jwtSecret, {
        expiresIn: this.config.jwtExpiresIn,
      });

      const newRefreshToken = jwt.sign(
        { userId: user.id, sessionId: session.id, type: "refresh" },
        this.config.jwtSecret,
        { expiresIn: this.config.refreshTokenExpiresIn },
      );

      session.token = newToken;
      session.refreshToken = newRefreshToken;
      session.lastUsedAt = new Date();

      this.emit("sessionRefreshed", session);
      return session;
    } catch (_error) {
      throw new Error("Invalid refresh token");
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit("sessionRevoked", session);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const userSessions = Array.from(this.sessions.values()).filter((s) => s.userId === userId);

    for (const session of userSessions) {
      this.sessions.delete(session.id);
      this.emit("sessionRevoked", session);
    }
  }

  // User management
  async updateUser(userId: string, updates: z.infer<typeof UpdateUserSchema>): Promise<User> {
    const validated = UpdateUserSchema.parse(updates);
    const user = this.users.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Apply updates
    if (validated.firstName !== undefined) user.firstName = validated.firstName;
    if (validated.lastName !== undefined) user.lastName = validated.lastName;
    if (validated.avatarUrl !== undefined) user.avatarUrl = validated.avatarUrl;
    if (validated.timezone !== undefined) user.timezone = validated.timezone;
    if (validated.locale !== undefined) user.locale = validated.locale;

    if (validated.preferences) {
      if (validated.preferences.theme) user.preferences.theme = validated.preferences.theme;
      if (validated.preferences.notifications) {
        Object.assign(user.preferences.notifications, validated.preferences.notifications);
      }
      if (validated.preferences.privacy) {
        Object.assign(user.preferences.privacy, validated.preferences.privacy);
      }
    }

    user.updatedAt = new Date();
    this.emit("userUpdated", user);

    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const currentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Validate new password
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new Error("Password must be between 8 and 128 characters");
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);
    user.updatedAt = new Date();

    // Revoke all sessions except current one
    await this.revokeAllUserSessions(userId);

    this.emit("passwordChanged", user);
  }

  // Email verification
  async sendEmailVerification(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.emailVerified) {
      throw new Error("Email already verified");
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMilliseconds(expiresAt.getMilliseconds() + this.config.emailVerificationExpiresIn);

    const verification: EmailVerification = {
      id: uuidv4(),
      userId,
      token,
      expiresAt,
      verified: false,
      createdAt: new Date(),
    };

    this.emailVerifications.set(token, verification);
    this.emit("emailVerificationSent", user, token);
  }

  async verifyEmail(token: string): Promise<User> {
    const verification = this.emailVerifications.get(token);
    if (!verification) {
      throw new Error("Invalid verification token");
    }

    if (verification.verified) {
      throw new Error("Email already verified");
    }

    if (verification.expiresAt < new Date()) {
      throw new Error("Verification token expired");
    }

    const user = this.users.get(verification.userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.emailVerified = true;
    user.status = "active";
    user.updatedAt = new Date();

    verification.verified = true;
    this.emailVerifications.delete(token);

    this.emit("emailVerified", user);
    return user;
  }

  // Password reset
  async requestPasswordReset(email: string): Promise<void> {
    const user = this.findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMilliseconds(expiresAt.getMilliseconds() + this.config.passwordResetExpiresIn);

    const resetRequest: PasswordResetRequest = {
      id: uuidv4(),
      userId: user.id,
      token,
      expiresAt,
      used: false,
      createdAt: new Date(),
    };

    this.passwordResets.set(token, resetRequest);
    this.emit("passwordResetRequested", user, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetRequest = this.passwordResets.get(token);
    if (!resetRequest) {
      throw new Error("Invalid reset token");
    }

    if (resetRequest.used) {
      throw new Error("Reset token already used");
    }

    if (resetRequest.expiresAt < new Date()) {
      throw new Error("Reset token expired");
    }

    const user = this.users.get(resetRequest.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Validate new password
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new Error("Password must be between 8 and 128 characters");
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);
    user.updatedAt = new Date();

    resetRequest.used = true;
    this.passwordResets.delete(token);

    // Revoke all sessions
    await this.revokeAllUserSessions(user.id);

    this.emit("passwordReset", user);
  }

  // Rate limiting and security
  private async checkRateLimit(email: string, _ip: string): Promise<void> {
    const attempts = this.loginAttempts.get(email) || [];
    const recentAttempts = attempts.filter(
      (attempt) => Date.now() - attempt.timestamp.getTime() < this.config.lockoutDuration,
    );

    if (recentAttempts.length >= this.config.maxLoginAttempts) {
      throw new Error("Too many login attempts. Please try again later.");
    }
  }

  private async recordLoginAttempt(
    email: string,
    ip: string,
    success: boolean,
    failureReason?: string,
  ): Promise<void> {
    const attempt: LoginAttempt = {
      id: uuidv4(),
      email,
      ip,
      success,
      failureReason,
      timestamp: new Date(),
    };

    const attempts = this.loginAttempts.get(email) || [];
    attempts.push(attempt);

    // Keep only recent attempts
    const recentAttempts = attempts.filter(
      (a) => Date.now() - a.timestamp.getTime() < this.config.lockoutDuration * 2,
    );

    this.loginAttempts.set(email, recentAttempts);
    this.emit("loginAttempt", attempt);
  }

  // Subscription management
  updateSubscription(
    userId: string,
    tier: User["subscriptionTier"],
    subscriptionId?: string,
    expiresAt?: Date,
  ): void {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.subscriptionTier = tier;
    user.subscriptionId = subscriptionId;
    user.subscriptionExpiresAt = expiresAt;
    user.limits = this.getSubscriptionLimits(tier);
    user.updatedAt = new Date();

    this.emit("subscriptionUpdated", user);
  }

  private getSubscriptionLimits(tier: User["subscriptionTier"]): User["limits"] {
    switch (tier) {
      case "free":
        return {
          maxCampaigns: 2,
          maxPlayersPerGame: 4,
          maxStorageGB: 1,
          maxAssets: 50,
          canUseCustomAssets: false,
          canUseAdvancedFeatures: false,
        };
      case "basic":
        return {
          maxCampaigns: 5,
          maxPlayersPerGame: 8,
          maxStorageGB: 5,
          maxAssets: 500,
          canUseCustomAssets: true,
          canUseAdvancedFeatures: false,
        };
      case "premium":
        return {
          maxCampaigns: 20,
          maxPlayersPerGame: 12,
          maxStorageGB: 25,
          maxAssets: 5000,
          canUseCustomAssets: true,
          canUseAdvancedFeatures: true,
        };
      case "enterprise":
        return {
          maxCampaigns: -1, // Unlimited
          maxPlayersPerGame: -1,
          maxStorageGB: 100,
          maxAssets: -1,
          canUseCustomAssets: true,
          canUseAdvancedFeatures: true,
        };
    }
  }

  // Social features
  async addFriend(userId: string, friendId: string): Promise<void> {
    const user = this.users.get(userId);
    const friend = this.users.get(friendId);

    if (!user || !friend) {
      throw new Error("User not found");
    }

    if (user.friends.includes(friendId)) {
      throw new Error("Already friends");
    }

    if (user.blockedUsers.includes(friendId) || friend.blockedUsers.includes(userId)) {
      throw new Error("Cannot add blocked user as friend");
    }

    user.friends.push(friendId);
    friend.friends.push(userId);

    this.emit("friendAdded", user, friend);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const user = this.users.get(userId);
    const friend = this.users.get(friendId);

    if (!user || !friend) {
      throw new Error("User not found");
    }

    user.friends = user.friends.filter((id) => id !== friendId);
    friend.friends = friend.friends.filter((id) => id !== userId);

    this.emit("friendRemoved", user, friend);
  }

  async blockUser(userId: string, targetId: string): Promise<void> {
    const user = this.users.get(userId);
    const target = this.users.get(targetId);

    if (!user || !target) {
      throw new Error("User not found");
    }

    if (user.blockedUsers.includes(targetId)) {
      throw new Error("User already blocked");
    }

    user.blockedUsers.push(targetId);

    // Remove from friends if they were friends
    user.friends = user.friends.filter((id) => id !== targetId);
    target.friends = target.friends.filter((id) => id !== userId);

    this.emit("userBlocked", user, target);
  }

  // Utility methods
  findUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  }

  findUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  // Admin functions
  async suspendUser(userId: string, reason: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.status = "suspended";
    user.updatedAt = new Date();

    // Revoke all sessions
    await this.revokeAllUserSessions(userId);

    this.emit("userSuspended", user, reason);
  }

  async reactivateUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.status = "active";
    user.updatedAt = new Date();

    this.emit("userReactivated", user);
  }

  // Cleanup functions
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions = Array.from(this.sessions.values()).filter((s) => s.expiresAt < now);

    for (const session of expiredSessions) {
      this.sessions.delete(session.id);
      this.emit("sessionExpired", session);
    }
  }

  async cleanupExpiredResets(): Promise<void> {
    const now = new Date();
    const expired = Array.from(this.passwordResets.entries()).filter(
      ([, reset]) => reset.expiresAt < now,
    );

    for (const [token] of expired) {
      this.passwordResets.delete(token);
    }
  }

  async cleanupExpiredVerifications(): Promise<void> {
    const now = new Date();
    const expired = Array.from(this.emailVerifications.entries()).filter(
      ([, verification]) => verification.expiresAt < now,
    );

    for (const [token] of expired) {
      this.emailVerifications.delete(token);
    }
  }

  // Statistics
  getUserStats(): {
    totalUsers: number;
    activeUsers: number;
    pendingVerification: number;
    suspendedUsers: number;
    subscriptionTiers: Record<string, number>;
    totalSessions: number;
  } {
    const users = Array.from(this.users.values());

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "active").length,
      pendingVerification: users.filter((u) => u.status === "pending_verification").length,
      suspendedUsers: users.filter((u) => u.status === "suspended").length,
      subscriptionTiers: users.reduce(
        (acc, user) => {
          acc[user.subscriptionTier] = (acc[user.subscriptionTier] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      totalSessions: this.sessions.size,
    };
  }
}
