/**
 * Authentication and authorization types
 */

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  passwordHash?: string; // Optional for public user objects
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  roles: Role[];
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  permissions: Set<string>;
  hasPermission: (_permission: string) => boolean;
  hasRole: (_role: string) => boolean;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  username: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
}

export interface GamePermissions {
  // Game management
  CREATE_GAME: "game:create";
  DELETE_GAME: "game:delete";
  EDIT_GAME: "game:edit";
  JOIN_GAME: "game:join";
  LEAVE_GAME: "game:leave";

  // Character management
  CREATE_CHARACTER: "character:create";
  EDIT_CHARACTER: "character:edit";
  DELETE_CHARACTER: "character:delete";
  VIEW_CHARACTER: "character:view";

  // Map and assets
  UPLOAD_ASSETS: "assets:upload";
  DELETE_ASSETS: "assets:delete";
  EDIT_MAP: "map:edit";
  VIEW_MAP: "map:view";

  // Game master permissions
  CONTROL_NPCS: "npc:control";
  MANAGE_COMBAT: "combat:manage";
  REVEAL_FOG: "fog:reveal";
  MOVE_TOKENS: "tokens:move";

  // Administrative
  MANAGE_USERS: "users:manage";
  VIEW_LOGS: "logs:view";
  MODERATE_CHAT: "chat:moderate";
}

export const GAME_PERMISSIONS: GamePermissions = {
  CREATE_GAME: "game:create",
  DELETE_GAME: "game:delete",
  EDIT_GAME: "game:edit",
  JOIN_GAME: "game:join",
  LEAVE_GAME: "game:leave",
  CREATE_CHARACTER: "character:create",
  EDIT_CHARACTER: "character:edit",
  DELETE_CHARACTER: "character:delete",
  VIEW_CHARACTER: "character:view",
  UPLOAD_ASSETS: "assets:upload",
  DELETE_ASSETS: "assets:delete",
  EDIT_MAP: "map:edit",
  VIEW_MAP: "map:view",
  CONTROL_NPCS: "npc:control",
  MANAGE_COMBAT: "combat:manage",
  REVEAL_FOG: "fog:reveal",
  MOVE_TOKENS: "tokens:move",
  MANAGE_USERS: "users:manage",
  VIEW_LOGS: "logs:view",
  MODERATE_CHAT: "chat:moderate",
};

export const _DEFAULT_ROLES = {
  ADMIN: "admin",
  GAME_MASTER: "game_master",
  PLAYER: "player",
  GUEST: "guest",
} as const;
