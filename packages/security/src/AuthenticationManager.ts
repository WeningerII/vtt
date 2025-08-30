/**
 * Authentication & Authorization System
 * JWT-based authentication with role-based access control and session management
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  emailVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string; // e.g., '15m', '1h'
  refreshTokenExpiry: string; // e.g., '7d', '30d'
  bcryptRounds: number;
  maxSessions: number;
  requireEmailVerification: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  acceptTerms: boolean;
  ipAddress?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: AuthToken;
  session?: AuthSession;
  error?: string;
  code?: string;
}

export class AuthenticationManager extends EventEmitter {
  private config: AuthConfig;
  private users = new Map<string, User>();
  private sessions = new Map<string, AuthSession>();
  private userSessions = new Map<string, Set<string>>(); // userId -> sessionIds
  private blacklistedTokens = new Set<string>();
  private refreshTokens = new Map<string, string>(); // refreshToken -> sessionId

  constructor(config: AuthConfig) {
    super();
    this.config = config;
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = Array.from(this.users.values())
        .find(u => u.email === data.email || u.username === data.username);
      
      if (existingUser) {
        return {
          success: false,
          error: existingUser.email === data.email ? 'Email already registered' : 'Username already taken',
          code: 'USER_EXISTS',
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, this.config.bcryptRounds);

      // Create user
      const user: User = {
        id: uuidv4(),
        email: data.email,
        username: data.username,
        passwordHash,
        roles: ['user'], // Default role
        permissions: ['read:own', 'write:own'],
        isActive: true,
        emailVerified: !this.config.requireEmailVerification,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.users.set(user.id, user);
      
      this.emit('userRegistered', { user: this.sanitizeUser(user), ipAddress: data.ipAddress });

      // Auto-login if email verification not required
      if (!this.config.requireEmailVerification) {
        const loginPayload: LoginCredentials = {
          email: data.email,
          password: data.password,
          ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
        };
        const loginResult = await this.login(loginPayload);
        return loginResult;
      }

      return {
        success: true,
        user: this.sanitizeUser(user),
      };
    } catch (_error) {
      return {
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
      };
    }
  }

  /**
   * Authenticate user and create session
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      // Find user by email
      const user = Array.from(this.users.values())
        .find(u => u.email === credentials.email);

      if (!user) {
        this.emit('loginFailed', { 
          email: credentials.email, 
          reason: 'user_not_found',
          ipAddress: credentials.ipAddress 
        });
        return {
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        };
      }

      // Check if user is active
      if (!user.isActive) {
        this.emit('loginFailed', { 
          userId: user.id, 
          reason: 'account_inactive',
          ipAddress: credentials.ipAddress 
        });
        return {
          success: false,
          error: 'Account is inactive',
          code: 'ACCOUNT_INACTIVE',
        };
      }

      // Check email verification if required
      if (this.config.requireEmailVerification && !user.emailVerified) {
        return {
          success: false,
          error: 'Email not verified',
          code: 'EMAIL_NOT_VERIFIED',
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValidPassword) {
        this.emit('loginFailed', { 
          userId: user.id, 
          reason: 'invalid_password',
          ipAddress: credentials.ipAddress 
        });
        return {
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        };
      }

      // Create session
      const session = await this.createSession(user, credentials);
      
      // Generate tokens
      const token = this.generateTokens(user, session);

      // Update user last login
      user.lastLogin = new Date();
      user.updatedAt = new Date();

      this.emit('loginSuccess', { 
        user: this.sanitizeUser(user), 
        session: session,
        ipAddress: credentials.ipAddress 
      });

      return {
        success: true,
        user: this.sanitizeUser(user),
        token,
        session,
      };
    } catch (error) {
      this.emit('loginError', { error, credentials: { email: credentials.email } });
      return {
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR',
      };
    }
  }

  /**
   * Logout user and invalidate session
   */
  async logout(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const decoded = this.verifyAccessToken(token);
      if (!decoded.valid || !decoded.payload) {
        return { success: false, error: 'Invalid token' };
      }

      const sessionId = decoded.payload.sessionId;
      const session = this.sessions.get(sessionId);
      
      if (session) {
        this.invalidateSession(sessionId);
        this.emit('logout', { userId: session.userId, sessionId });
      }

      this.blacklistedTokens.add(token);
      
      return { success: true };
    } catch (_error) {
      return { success: false, error: 'Logout failed' };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const sessionId = this.refreshTokens.get(refreshToken);
      if (!sessionId) {
        return {
          success: false,
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        };
      }

      const session = this.sessions.get(sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        this.refreshTokens.delete(refreshToken);
        return {
          success: false,
          error: 'Session expired',
          code: 'SESSION_EXPIRED',
        };
      }

      const user = this.users.get(session.userId);
      if (!user || !user.isActive) {
        this.invalidateSession(sessionId);
        return {
          success: false,
          error: 'User not found or inactive',
          code: 'USER_INACTIVE',
        };
      }

      // Generate new tokens
      const newTokens = this.generateTokens(user, session);
      
      // Update session with new refresh token
      this.refreshTokens.delete(refreshToken);
      this.refreshTokens.set(newTokens.refreshToken, sessionId);

      this.emit('tokenRefreshed', { userId: user.id, sessionId });

      return {
        success: true,
        user: this.sanitizeUser(user),
        token: newTokens,
        session,
      };
    } catch (_error) {
      return {
        success: false,
        error: 'Token refresh failed',
        code: 'REFRESH_ERROR',
      };
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      if (this.blacklistedTokens.has(token)) {
        return { valid: false, error: 'Token blacklisted' };
      }

      const payload = jwt.verify(token, this.config.jwtSecret) as any;
      
      // Check if session is still active
      const session = this.sessions.get(payload.sessionId);
      if (!session || !session.isActive) {
        return { valid: false, error: 'Session inactive' };
      }

      return { valid: true, payload };
    } catch (_error) {
      return { valid: false, error: 'Invalid token' };
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(userId: string, permission: string): boolean {
    const user = this.users.get(userId);
    if (!user || !user.isActive) return false;

    // Check direct permissions
    if (user.permissions.includes(permission)) return true;

    // Check role-based permissions
    return this.checkRolePermissions(user.roles, permission);
  }

  /**
   * Check if user has role
   */
  hasRole(userId: string, role: string): boolean {
    const user = this.users.get(userId);
    return user?.roles.includes(role) || false;
  }

  /**
   * Add role to user
   */
  addRole(userId: string, role: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    if (!user.roles.includes(role)) {
      user.roles.push(role);
      user.updatedAt = new Date();
      this.emit('roleAdded', { userId, role });
    }

    return true;
  }

  /**
   * Remove role from user
   */
  removeRole(userId: string, role: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    const index = user.roles.indexOf(role);
    if (index > -1) {
      user.roles.splice(index, 1);
      user.updatedAt = new Date();
      this.emit('roleRemoved', { userId, role });
    }

    return true;
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId: string): AuthSession[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(session => session && session.isActive) as AuthSession[];
  }

  /**
   * Invalidate all user sessions except current
   */
  invalidateOtherSessions(userId: string, currentSessionId: string): number {
    const sessionIds = this.userSessions.get(userId) || new Set();
    let invalidatedCount = 0;

    for (const sessionId of sessionIds) {
      if (sessionId !== currentSessionId) {
        this.invalidateSession(sessionId);
        invalidatedCount++;
      }
    }

    this.emit('otherSessionsInvalidated', { userId, count: invalidatedCount });
    return invalidatedCount;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify old password
      const isValidPassword = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isValidPassword) {
        this.emit('passwordChangeFailed', { userId, reason: 'invalid_old_password' });
        return { success: false, error: 'Invalid current password' };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.config.bcryptRounds);
      user.passwordHash = newPasswordHash;
      user.updatedAt = new Date();

      // Invalidate all sessions except current to force re-login
      this.invalidateAllUserSessions(userId);

      this.emit('passwordChanged', { userId });
      return { success: true };
    } catch (_error) {
      return { success: false, error: 'Password change failed' };
    }
  }

  private async createSession(user: User, credentials: LoginCredentials): Promise<AuthSession> {
    const sessionId = uuidv4();
    const refreshToken = uuidv4();
    
    const session: AuthSession = {
      id: sessionId,
      userId: user.id,
      token: '', // Will be set when generating JWT
      refreshToken,
      expiresAt: new Date(Date.now() + this.parseTimeToMs(this.config.refreshTokenExpiry)),
      createdAt: new Date(),
      isActive: true,
    };
    if (credentials.ipAddress) session.ipAddress = credentials.ipAddress;
    if (credentials.userAgent) session.userAgent = credentials.userAgent;

    // Store session
    this.sessions.set(sessionId, session);
    this.refreshTokens.set(refreshToken, sessionId);

    // Track user sessions
    if (!this.userSessions.has(user.id)) {
      this.userSessions.set(user.id, new Set());
    }
    this.userSessions.get(user.id)!.add(sessionId);

    // Enforce max sessions limit
    this.enforceMaxSessions(user.id);

    return session;
  }

  private generateTokens(user: User, session: AuthSession): AuthToken {
    const accessTokenExpiry = this.parseTimeToMs(this.config.accessTokenExpiry);
    
    const accessToken = jwt.sign(
      {
        userId: user.id,
        sessionId: session.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
      },
      this.config.jwtSecret,
      { expiresIn: Math.floor(accessTokenExpiry / 1000) }
    );

    session.token = accessToken;

    return {
      accessToken,
      refreshToken: session.refreshToken,
      expiresIn: Math.floor(accessTokenExpiry / 1000),
      tokenType: 'Bearer',
    };
  }

  private invalidateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;
    this.sessions.delete(sessionId);
    this.refreshTokens.delete(session.refreshToken);

    const userSessionIds = this.userSessions.get(session.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
    }

    if (session.token) {
      this.blacklistedTokens.add(session.token);
    }
  }

  private invalidateAllUserSessions(userId: string): void {
    const sessionIds = this.userSessions.get(userId) || new Set();
    for (const sessionId of sessionIds) {
      this.invalidateSession(sessionId);
    }
    this.userSessions.delete(userId);
  }

  private enforceMaxSessions(userId: string): void {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds || sessionIds.size <= this.config.maxSessions) return;

    // Get sessions sorted by creation time (oldest first)
    const sessions = Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter(session => session)
      .sort((a, b) => a!.createdAt.getTime() - b!.createdAt.getTime()) as AuthSession[];

    // Remove oldest sessions
    const toRemove = sessions.slice(0, sessions.length - this.config.maxSessions);
    for (const session of toRemove) {
      this.invalidateSession(session.id);
    }
  }

  private checkRolePermissions(roles: string[], permission: string): boolean {
    // Simple role-based permissions - in practice would be more sophisticated
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // Admin has all permissions
      gm: ['read:*', 'write:*', 'manage:scenes', 'manage:tokens'],
      player: ['read:own', 'write:own', 'read:scenes', 'write:tokens'],
      user: ['read:own', 'write:own'],
    };

    for (const role of roles) {
      const permissions = rolePermissions[role] || [];
      if (permissions.includes('*') || permissions.includes(permission)) {
        return true;
      }
      
      // Check wildcard permissions
      if (permissions.some(p => p.endsWith('*') && permission.startsWith(p.slice(0, -1)))) {
        return true;
      }
    }

    return false;
  }

  private sanitizeUser(user: User): User {
    // Redact sensitive fields while preserving the type shape
    return { ...user, passwordHash: 'REDACTED' };
  }

  private parseTimeToMs(timeString: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid time format: ${timeString}`);

    const amount = match[1]!;
    const unit = match[2]! as keyof typeof units;
    const unitMs = units[unit];
    if (unitMs === undefined) {
      throw new Error(`Invalid time unit: ${unit}`);
    }
    return parseInt(amount) * unitMs;
  }
}
