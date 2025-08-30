/**
 * Authentication and Authorization Types
 */

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  subscription: SubscriptionTier;
  isEmailVerified: boolean;
  isTwoFactorEnabled: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = "admin" | "moderator" | "gamemaster" | "player" | "guest";

export type Permission =
  | "session.create"
  | "session.join"
  | "session.manage"
  | "session.delete"
  | "content.create"
  | "content.edit"
  | "content.delete"
  | "content.publish"
  | "user.manage"
  | "user.moderate"
  | "system.admin"
  | "billing.manage";

export type SubscriptionTier = "free" | "basic" | "premium" | "enterprise";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  displayName: string;
  acceptTerms: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  newPassword: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface SessionPermissions {
  canCreateTokens: boolean;
  canMoveTokens: boolean;
  canEditMap: boolean;
  canManagePlayers: boolean;
  canControlCombat: boolean;
  canUseFogOfWar: boolean;
  canPlayAudio: boolean;
  canManageAssets: boolean;
  canViewGMNotes: boolean;
  canRollDice: boolean;
  canUseChat: boolean;
}

export interface SecuritySettings {
  requireTwoFactor: boolean;
  sessionTimeout: number; // minutes
  maxFailedAttempts: number;
  lockoutDuration: number; // minutes
  requireEmailVerification: boolean;
  allowGuestAccess: boolean;
  enforcePasswordComplexity: boolean;
  enableAuditLogging: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | undefined;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  sessionId?: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface SecurityContext {
  user: User;
  session: AuthSession;
  permissions: Permission[];
  ipAddress: string;
  userAgent: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
}

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration: string;
  refreshTokenExpiration: string;
  bcryptRounds: number;
  rateLimits: {
    login: RateLimitConfig;
    register: RateLimitConfig;
    passwordReset: RateLimitConfig;
    general: RateLimitConfig;
  };
  security: SecuritySettings;
  oauth: {
    google?: OAuthConfig;
    discord?: OAuthConfig;
    github?: OAuthConfig;
  };
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface AuthEvent {
  type:
    | "login"
    | "logout"
    | "register"
    | "password_reset"
    | "permission_change"
    | "security_violation";
  userId: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}
