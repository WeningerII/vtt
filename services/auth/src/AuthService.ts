/**
 * Core authentication service
 */

import {
  User,
  _Session,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  JWTPayload,
  AuthContext,
} from "./types";
import { logger } from "@vtt/logging";
import { JWTManager } from "./JWTManager";
import { PasswordManager } from "./PasswordManager";
import { SessionManager } from "./SessionManager";
import { UserRepository } from "./UserRepository";

export class AuthService {
  private jwtManager: JWTManager;
  private passwordManager: PasswordManager;
  private sessionManager: SessionManager;
  private userRepository: UserRepository;

  constructor(
    jwtManager: JWTManager,
    passwordManager: PasswordManager,
    sessionManager: SessionManager,
    userRepository: UserRepository,
  ) {
    this.jwtManager = jwtManager;
    this.passwordManager = passwordManager;
    this.sessionManager = sessionManager;
    this.userRepository = userRepository;
  }

  async login(request: LoginRequest, ipAddress?: string, userAgent?: string): Promise<AuthTokens> {
    const { email, password, rememberMe = false } = request;

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    if (!user.passwordHash) {
      throw new Error("Invalid credentials");
    }
    const isValidPassword = await this.passwordManager.verify(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error("Account is disabled");
    }

    // Generate tokens
    const tokens = await this.generateTokens(user, rememberMe);

    // Create session
    await this.sessionManager.createSession({
      userId: user.id,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      ipAddress,
      userAgent,
    });

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return tokens;
  }

  async register(request: RegisterRequest): Promise<User> {
    const { email, username, password, displayName } = request;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error("User already exists");
    }

    const existingUsername = await this.userRepository.findByUsername(username);
    if (existingUsername) {
      throw new Error("Username already taken");
    }

    // Validate password strength
    this.passwordManager.validatePassword(password);

    // Hash password
    const passwordHash = await this.passwordManager.hash(password);

    // Create user
    const user = await this.userRepository.create({
      email,
      username,
      displayName,
      passwordHash,
      isEmailVerified: false,
      isActive: true,
      roles: ["player"], // Default role
    });

    // Send verification email (implement separately)
    await this.sendVerificationEmail(user);

    return user;
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const payload = await this.jwtManager.verifyRefreshToken(refreshToken);

    // Get session
    const session = await this.sessionManager.getSessionByRefreshToken(refreshToken);
    if (!session || session.expiresAt < new Date()) {
      throw new Error("Invalid or expired refresh token");
    }

    // Get user
    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new Error("User not found or inactive");
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Update session
    await this.sessionManager.updateSession(session.id, {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    });

    return tokens;
  }

  async logout(token: string): Promise<void> {
    const session = await this.sessionManager.getSessionByToken(token);
    if (session) {
      await this.sessionManager.deleteSession(session.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionManager.deleteAllUserSessions(userId);
  }

  async verifyToken(token: string): Promise<AuthContext> {
    try {
      const payload = await this.jwtManager.verifyAccessToken(token);

      // Get user to ensure they're still active
      const user = await this.userRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new Error("User not found or inactive");
      }

      const permissions = new Set<string>(payload.permissions);

      return {
        user,
        isAuthenticated: true,
        permissions,
        hasPermission: (_permission: string) => permissions.has(permission),
        hasRole: (role: string) => payload.roles.includes(role),
      };
    } catch (_error) {
      return {
        user: null,
        isAuthenticated: false,
        permissions: new Set(),
        hasPermission: () => false,
        hasRole: () => false,
      };
    }
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    if (!user.passwordHash) {
      throw new Error("Invalid current password");
    }
    const isValidPassword = await this.passwordManager.verify(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Invalid current password");
    }

    // Validate new password
    this.passwordManager.validatePassword(newPassword);

    // Hash new password
    const newPasswordHash = await this.passwordManager.hash(newPassword);

    // Update password
    await this.userRepository.updatePassword(userId, newPasswordHash);

    // Logout all sessions to force re-login
    await this.logoutAll(userId);
  }

  async resetPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const resetToken = await this.jwtManager.generatePasswordResetToken(user.id);

    // Store reset token (implement token storage)
    await this.userRepository.storePasswordResetToken(user.id, resetToken);

    // Send reset email (implement separately)
    await this.sendPasswordResetEmail(user, resetToken);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    // Verify reset token
    const payload = await this.jwtManager.verifyPasswordResetToken(token);

    // Check if token is still valid in storage
    const isValidToken = await this.userRepository.isValidPasswordResetToken(payload.sub, token);
    if (!isValidToken) {
      throw new Error("Invalid or expired reset token");
    }

    // Validate new password
    this.passwordManager.validatePassword(newPassword);

    // Hash new password
    const passwordHash = await this.passwordManager.hash(newPassword);

    // Update password
    await this.userRepository.updatePassword(payload.sub, passwordHash);

    // Clear reset token
    await this.userRepository.clearPasswordResetToken(payload.sub);

    // Logout all sessions
    await this.logoutAll(payload.sub);
  }

  async verifyEmail(token: string): Promise<void> {
    const payload = await this.jwtManager.verifyEmailVerificationToken(token);
    await this.userRepository.markEmailAsVerified(payload.sub);
  }

  private async generateTokens(user: User, longExpiry = false): Promise<AuthTokens> {
    const permissions = user.roles.flatMap((role) => role.permissions.map((p) => p.name));
    const roleNames = user.roles.map((role) => role.name);

    const payload: Omit<JWTPayload, "iat" | "exp" | "iss"> = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: roleNames,
      permissions,
    };

    const expiresIn = longExpiry ? 30 * 24 * 60 * 60 : 60 * 60; // 30 days or 1 hour
    const accessToken = await this.jwtManager.generateAccessToken(payload, expiresIn);
    const refreshToken = await this.jwtManager.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    // Generate verification token
    const verificationToken = await this.jwtManager.generateEmailVerificationToken(user.id);

    // TODO: Implement email sending
    logger.info(`Send verification email to ${user.email} with token: ${verificationToken}`);
  }

  private async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    // TODO: Implement email sending
    logger.info(`Send password reset email to ${user.email} with token: ${resetToken}`);
  }
}
