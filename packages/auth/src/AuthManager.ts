/**
 * Core Authentication Manager
 */

import { EventEmitter } from "events";
import { logger } from "@vtt/logging";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import * as speakeasy from "speakeasy";
import * as qrcode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import {
  User,
  LoginCredentials,
  RegisterData,
  AuthTokens,
  JWTPayload,
  AuthConfig,
  SecurityContext,
  AuthSession,
  TwoFactorSetup,
  PasswordResetRequest,
  PasswordReset,
  AuthEvent,
} from "./types";

export class AuthManager extends EventEmitter {
  private config: AuthConfig;
  private activeSessions = new Map<string, AuthSession>();
  private failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  private userCache = new Map<string, User>();
  private mockDatabase = { users: [] as User[] };

  constructor(config: AuthConfig) {
    super();
    this.config = config;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<User> {
    // Validate input
    this.validateRegistrationData(data);

    // Check if user already exists
    const existingUser = await this.findUserByEmail(data.email);
    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    const existingUsername = await this.findUserByUsername(data.username);
    if (existingUsername) {
      throw new Error("Username already taken");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, this.config.bcryptRounds);

    // Create user
    const user: User = {
      id: uuidv4(),
      email: data.email.toLowerCase(),
      username: data.username,
      displayName: data.displayName,
      role: "player",
      permissions: this.getDefaultPermissions("player"),
      subscription: "free",
      isEmailVerified: false,
      isTwoFactorEnabled: false,
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store user (would typically be in database)
    await this.storeUser(user, hashedPassword);

    // Send verification email if required
    if (this.config.security.requireEmailVerification) {
      await this.sendVerificationEmail(user);
    }

    this.emitAuthEvent("register", user.id, { email: data.email });
    return user;
  }

  /**
   * Find user by ID (used by OAuth)
   */
  async findUserById(id: string): Promise<User | null> {
    logger.info(`Finding user by ID: ${id}`);

    try {
      // Check in-memory cache first
      const cachedUser = this.userCache.get(id);
      if (cachedUser) {
        return cachedUser;
      }

      // Query database (using mock data for now)
      // In production, this would be a proper database query
      const user = this.mockDatabase.users.find((u) => u.id === id);

      if (user) {
        // Cache the user for future requests
        this.userCache.set(id, user);
        return user;
      }

      return null;
    } catch (error) {
      logger.error(`Error finding user by ID ${id}:`, error as Record<string, any>);
      return null;
    }
  }

  /**
   * Generate tokens for OAuth authenticated user (public version)
   */
  async generateOAuthTokens(user: User): Promise<AuthTokens> {
    // Create a session for OAuth user
    const session: AuthSession = {
      id: uuidv4(),
      userId: user.id,
      deviceId: "oauth-device",
      ipAddress: "0.0.0.0",
      userAgent: "oauth",
      isActive: true,
      lastActivity: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    return this.generateTokens(user, session);
  }

  /**
   * Authenticate user login
   */
  async login(
    credentials: LoginCredentials,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ user: User; tokens: AuthTokens; session: AuthSession }> {
    const { email, password, twoFactorCode, rememberMe } = credentials;

    // Check rate limiting
    await this.checkRateLimit(email, "login");

    // Find user
    const user = await this.findUserByEmail(email);
    if (!user) {
      await this.recordFailedAttempt(email);
      throw new Error("Invalid credentials");
    }

    // Check if account is locked
    if (await this.isAccountLocked(user.id)) {
      throw new Error("Account is temporarily locked due to too many failed attempts");
    }

    // Verify password
    const storedPassword = await this.getStoredPassword(user.id);
    const isPasswordValid = await bcrypt.compare(password, storedPassword);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(email);
      throw new Error("Invalid credentials");
    }

    // Check two-factor authentication
    if (user.isTwoFactorEnabled) {
      if (!twoFactorCode) {
        throw new Error("Two-factor authentication code required");
      }

      const isValidTwoFactor = await this.verifyTwoFactorCode(user.id, twoFactorCode);
      if (!isValidTwoFactor) {
        await this.recordFailedAttempt(email);
        throw new Error("Invalid two-factor authentication code");
      }
    }

    // Clear failed attempts
    this.failedAttempts.delete(email);

    // Create session
    const session = await this.createSession(user, ipAddress, userAgent, rememberMe);

    // Generate tokens
    const tokens = await this.generateTokens(user, session);

    // Update last login
    user.lastLogin = new Date();
    await this.updateUser(user);

    this.emitAuthEvent("login", user.id, { ipAddress, userAgent });
    return { user, tokens, session };
  }

  /**
   * Refresh authentication tokens
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as JWTPayload;
      const session = this.activeSessions.get(decoded.sessionId);

      if (!session || !session.isActive) {
        throw new Error("Invalid session");
      }

      const user = await this.findUserById(decoded.sub);
      if (!user) {
        throw new Error("User not found");
      }

      // Update session activity
      session.lastActivity = new Date();

      return this.generateTokens(user, session);
    } catch (_error) {
      throw new Error("Invalid refresh token");
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(sessionId);
      this.emitAuthEvent("logout", session.userId, { sessionId });
    }
  }

  /**
   * Validate JWT token and return security context
   */
  async validateToken(
    token: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<SecurityContext> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as JWTPayload;
      const session = this.activeSessions.get(decoded.sessionId);

      if (!session || !session.isActive) {
        throw new Error("Invalid session");
      }

      // Check session expiry
      if (session.expiresAt < new Date()) {
        session.isActive = false;
        this.activeSessions.delete(decoded.sessionId);
        throw new Error("Session expired");
      }

      const user = await this.findUserById(decoded.sub);
      if (!user) {
        throw new Error("User not found");
      }

      // Update session activity
      session.lastActivity = new Date();

      return {
        user,
        session,
        permissions: user.permissions,
        ipAddress,
        userAgent,
      };
    } catch (_error) {
      throw new Error("Invalid token");
    }
  }

  /**
   * Setup two-factor authentication
   */
  async setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const secret = speakeasy.generateSecret({
      name: `VTT:${user.email}`,
      issuer: "Virtual Tabletop",
    });

    const qrCode = await qrcode.toDataURL(secret.otpauth_url!);
    const backupCodes = this.generateBackupCodes();

    // Store secret temporarily (user must verify before enabling)
    await this.storeTempTwoFactorSecret(userId, secret.base32, backupCodes);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactor(userId: string, verificationCode: string): Promise<boolean> {
    const tempSecret = await this.getTempTwoFactorSecret(userId);
    if (!tempSecret) {
      throw new Error("Two-factor setup not initiated");
    }

    const isValid = speakeasy.totp.verify({
      secret: tempSecret.secret,
      encoding: "base32",
      token: verificationCode,
      window: 2,
    });

    if (!isValid) {
      throw new Error("Invalid verification code");
    }

    // Enable 2FA for user
    const user = await this.findUserById(userId);
    if (user) {
      user.isTwoFactorEnabled = true;
      await this.updateUser(user);
      await this.storeTwoFactorSecret(userId, tempSecret.secret, tempSecret.backupCodes);
      await this.deleteTempTwoFactorSecret(userId);
    }

    return true;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    const user = await this.findUserByEmail(request.email);
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await this.storePasswordResetToken(user.id, resetToken, expiresAt);
    await this.sendPasswordResetEmail(user, resetToken);
  }

  /**
   * Reset password
   */
  async resetPassword(reset: PasswordReset): Promise<boolean> {
    const resetData = await this.getPasswordResetToken(reset.token);
    if (!resetData || resetData.expiresAt < new Date()) {
      throw new Error("Invalid or expired reset token");
    }

    // Validate new password
    this.validatePassword(reset.newPassword);

    // Hash new password
    const hashedPassword = await bcrypt.hash(reset.newPassword, this.config.bcryptRounds);

    // Update password
    await this.updatePassword(resetData.userId, hashedPassword);
    await this.deletePasswordResetToken(reset.token);

    // Invalidate all sessions for this user
    await this.invalidateUserSessions(resetData.userId);

    this.emitAuthEvent("password_reset", resetData.userId, {});
    return true;
  }

  /**
   * Check user permissions
   */
  hasPermission(context: SecurityContext, permission: string): boolean {
    return context.permissions.includes(permission as any);
  }

  /**
   * Check user role
   */
  hasRole(context: SecurityContext, role: string): boolean {
    const roleHierarchy: Record<string, number> = {
      guest: 0,
      player: 1,
      gamemaster: 2,
      moderator: 3,
      admin: 4,
    };

    const userLevel = roleHierarchy[context.user.role] || 0;
    const requiredLevel = roleHierarchy[role] || 0;

    return userLevel >= requiredLevel;
  }

  // Private helper methods

  private async generateTokens(user: User, session: AuthSession): Promise<AuthTokens> {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId: session.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      iss: "vtt-auth",
      aud: "vtt-client",
    };

    const accessToken = jwt.sign(payload, this.config.jwtSecret);
    const refreshPayload = {
      sub: user.id,
      sessionId: session.id,
      iat: Math.floor(Date.now() / 1000),
    };

    const refreshOptions = {
      expiresIn: this.config.refreshTokenExpiration,
    } as jwt.SignOptions;

    const refreshToken = jwt.sign(refreshPayload, this.config.jwtSecret, refreshOptions);

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    };
  }

  private async createSession(
    user: User,
    ipAddress: string,
    userAgent: string,
    rememberMe?: boolean,
  ): Promise<AuthSession> {
    const session: AuthSession = {
      id: uuidv4(),
      userId: user.id,
      deviceId: this.generateDeviceId(userAgent),
      ipAddress,
      userAgent,
      isActive: true,
      lastActivity: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(
        Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
      ), // 30 days or 1 day
    };

    this.activeSessions.set(session.id, session);
    return session;
  }

  private generateDeviceId(userAgent: string): string {
    // Generate a device fingerprint based on user agent
    return Buffer.from(userAgent).toString("base64").substring(0, 16);
  }

  private async verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
    const secret = await this.getTwoFactorSecret(userId);
    if (!secret) {
      return false;
    }

    // Check TOTP code
    const isValidTOTP = speakeasy.totp.verify({
      secret: secret.secret,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (isValidTOTP) {
      return true;
    }

    // Check backup codes
    const isValidBackup = secret.backupCodes.includes(code);
    if (isValidBackup) {
      // Remove used backup code
      const updatedCodes = secret.backupCodes.filter((c) => c !== code);
      await this.updateBackupCodes(userId, updatedCodes);
      return true;
    }

    return false;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  private validateRegistrationData(data: RegisterData): void {
    if (!data.email || !this.isValidEmail(data.email)) {
      throw new Error("Invalid email address");
    }

    if (!data.username || data.username.length < 3 || data.username.length > 20) {
      throw new Error("Username must be between 3 and 20 characters");
    }

    if (!data.password) {
      throw new Error("Password is required");
    }

    this.validatePassword(data.password);

    if (!data.acceptTerms) {
      throw new Error("Must accept terms of service");
    }
  }

  private validatePassword(password: string): void {
    if (!this.config.security.enforcePasswordComplexity) {
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }
      return;
    }

    if (password.length < 12) {
      throw new Error("Password must be at least 12 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      throw new Error("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      throw new Error("Password must contain at least one lowercase letter");
    }

    if (!/[0-9]/.test(password)) {
      throw new Error("Password must contain at least one number");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      throw new Error("Password must contain at least one special character");
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private getDefaultPermissions(role: string): any[] {
    const permissions: Record<string, string[]> = {
      guest: ["session.join"],
      player: ["session.join", "session.create"],
      gamemaster: [
        "session.join",
        "session.create",
        "session.manage",
        "content.create",
        "content.edit",
      ],
      moderator: [
        "session.join",
        "session.create",
        "session.manage",
        "content.create",
        "content.edit",
        "user.moderate",
      ],
      admin: [
        "session.join",
        "session.create",
        "session.manage",
        "session.delete",
        "content.create",
        "content.edit",
        "content.delete",
        "content.publish",
        "user.manage",
        "user.moderate",
        "system.admin",
        "billing.manage",
      ],
    };

    return permissions[role] || permissions["guest"] || [];
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    const current = this.failedAttempts.get(email) || { count: 0, lastAttempt: new Date() };
    current.count++;
    current.lastAttempt = new Date();
    this.failedAttempts.set(email, current);
  }

  private async isAccountLocked(_userId: string): Promise<boolean> {
    // Implementation would check database for lock status
    return false;
  }

  private async checkRateLimit(_identifier: string, _type: string): Promise<void> {
    // Implementation would use rate limiter
    // For now, just a placeholder
  }

  private emitAuthEvent(type: string, userId: string, details: Record<string, any>): void {
    const event: AuthEvent = {
      type: type as any,
      userId,
      details,
      timestamp: new Date(),
      ipAddress: details.ipAddress || "",
      userAgent: details.userAgent || "",
    };

    this.emit("authEvent", event);
  }

  // Database interaction methods (would be implemented with actual database)
  async findUserByEmail(_email: string): Promise<User | null> {
    // Placeholder - would query database
    return null;
  }

  private async findUserByUsername(_username: string): Promise<User | null> {
    // Placeholder - would query database
    return null;
  }

  private async storeUser(_user: User, _hashedPassword: string): Promise<void> {
    // Placeholder - would store in database
  }

  private async updateUser(_user: User): Promise<void> {
    // Placeholder - would update database
  }

  private async getStoredPassword(_userId: string): Promise<string> {
    // Placeholder - would query database
    return "";
  }

  private async updatePassword(_userId: string, _hashedPassword: string): Promise<void> {
    // Placeholder - would update database
  }

  private async sendVerificationEmail(_user: User): Promise<void> {
    // Placeholder - would send email
  }

  private async sendPasswordResetEmail(_user: User, _token: string): Promise<void> {
    // Placeholder - would send email
  }

  private async storeTempTwoFactorSecret(
    _userId: string,
    _secret: string,
    _backupCodes: string[],
  ): Promise<void> {
    // Placeholder - would store in database
  }

  private async getTempTwoFactorSecret(
    _userId: string,
  ): Promise<{ secret: string; backupCodes: string[] } | null> {
    // Placeholder - would query database
    return null;
  }

  private async deleteTempTwoFactorSecret(_userId: string): Promise<void> {
    // Placeholder - would delete from database
  }

  private async storeTwoFactorSecret(
    _userId: string,
    _secret: string,
    _backupCodes: string[],
  ): Promise<void> {
    // Placeholder - would store in database
  }

  private async getTwoFactorSecret(
    _userId: string,
  ): Promise<{ secret: string; backupCodes: string[] } | null> {
    // Placeholder - would query database
    return null;
  }

  private async updateBackupCodes(_userId: string, _backupCodes: string[]): Promise<void> {
    // Placeholder - would update database
  }

  private async storePasswordResetToken(
    _userId: string,
    _token: string,
    _expiresAt: Date,
  ): Promise<void> {
    // Placeholder - would store in database
  }

  private async getPasswordResetToken(
    _token: string,
  ): Promise<{ userId: string; expiresAt: Date } | null> {
    // Placeholder - would query database
    return null;
  }

  private async deletePasswordResetToken(_token: string): Promise<void> {
    // Placeholder - would delete from database
  }

  private async invalidateUserSessions(userId: string): Promise<void> {
    // Invalidate all active sessions for user
    for (const [sessionId, session] of this.activeSessions) {
      if (session.userId === userId) {
        session.isActive = false;
        this.activeSessions.delete(sessionId);
      }
    }
  }
}
