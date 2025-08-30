/**
 * User data repository interface and implementation
 */

import { User, Role, Permission } from './types';

export interface CreateUserRequest {
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  isEmailVerified: boolean;
  isActive: boolean;
  roles: string[];
}

export interface UserRepository {
  create(data: CreateUserRequest): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  updateLastLogin(id: string): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  markEmailAsVerified(id: string): Promise<void>;
  storePasswordResetToken(id: string, token: string): Promise<void>;
  isValidPasswordResetToken(id: string, token: string): Promise<boolean>;
  clearPasswordResetToken(id: string): Promise<void>;
  updateProfile(id: string, data: Partial<Pick<User, 'displayName' | 'avatar'>>): Promise<User>;
  deactivateUser(id: string): Promise<void>;
  activateUser(id: string): Promise<void>;
  assignRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;
}

export interface RoleRepository {
  create(name: string, permissions: string[]): Promise<Role>;
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  findAll(): Promise<Role[]>;
  update(id: string, data: Partial<Pick<Role, 'name'>>): Promise<Role>;
  delete(id: string): Promise<void>;
  addPermission(roleId: string, permissionId: string): Promise<void>;
  removePermission(roleId: string, permissionId: string): Promise<void>;
}

export interface PermissionRepository {
  create(name: string, resource: string, action: string): Promise<Permission>;
  findById(id: string): Promise<Permission | null>;
  findByName(name: string): Promise<Permission | null>;
  findAll(): Promise<Permission[]>;
  findByResource(resource: string): Promise<Permission[]>;
  delete(id: string): Promise<void>;
}

// In-memory implementation for development/testing
export class InMemoryUserRepository implements UserRepository {
  private users: Map<string, User & { passwordHash: string; isActive: boolean; passwordResetTokens: Set<string> }> = new Map();
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private userIdCounter = 1;
  private roleIdCounter = 1;
  private permissionIdCounter = 1;

  constructor() {
    this.initializeDefaultData();
  }

  async create(data: CreateUserRequest): Promise<User> {
    const id = `user_${this.userIdCounter++}`;
    const now = new Date();
    
    const userRoles = await Promise.all(
      data.roles.map(roleName => this.findRoleByName(roleName))
    );
    
    const validRoles = userRoles.filter((role): role is Role => role !== null);

    const user = {
      id,
      email: data.email,
      username: data.username,
      displayName: data.displayName,
      isEmailVerified: data.isEmailVerified,
      createdAt: now,
      updatedAt: now,
      roles: validRoles,
      passwordHash: data.passwordHash,
      isActive: data.isActive,
      passwordResetTokens: new Set<string>(),
    };

    this.users.set(id, user);

    // Return user without sensitive data
    const { _passwordHash, _passwordResetTokens,  ...publicUser  } = user;
    return publicUser;
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const { _passwordHash, _passwordResetTokens,  ...publicUser  } = user;
    return publicUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        const { passwordHash, _passwordResetTokens,  ...publicUser  } = user;
        return { ...publicUser, passwordHash }; // Include passwordHash for auth
      }
    }
    return null;
  }

  async findByUsername(username: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        const { _passwordHash, _passwordResetTokens,  ...publicUser  } = user;
        return publicUser;
      }
    }
    return null;
  }

  async updateLastLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      user.updatedAt = new Date();
    }
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
    }
  }

  async markEmailAsVerified(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.isEmailVerified = true;
      user.updatedAt = new Date();
    }
  }

  async storePasswordResetToken(id: string, token: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.passwordResetTokens.add(token);
    }
  }

  async isValidPasswordResetToken(id: string, token: string): Promise<boolean> {
    const user = this.users.get(id);
    return user ? user.passwordResetTokens.has(token) : false;
  }

  async clearPasswordResetToken(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.passwordResetTokens.clear();
    }
  }

  async updateProfile(id: string, data: Partial<Pick<User, 'displayName' | 'avatar'>>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (data.displayName !== undefined) user.displayName = data.displayName;
    if (data.avatar !== undefined) user.avatar = data.avatar;
    user.updatedAt = new Date();

    const { _passwordHash, _passwordResetTokens,  ...publicUser  } = user;
    return publicUser;
  }

  async deactivateUser(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.isActive = false;
      user.updatedAt = new Date();
    }
  }

  async activateUser(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.isActive = true;
      user.updatedAt = new Date();
    }
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);
    
    if (user && role) {
      if (!user.roles.some(r => r.id === roleId)) {
        user.roles.push(role);
        user.updatedAt = new Date();
      }
    }
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const user = this.users.get(userId);
    
    if (user) {
      user.roles = user.roles.filter(r => r.id !== roleId);
      user.updatedAt = new Date();
    }
  }

  private async findRoleByName(name: string): Promise<Role | null> {
    for (const role of this.roles.values()) {
      if (role.name === name) {
        return role;
      }
    }
    return null;
  }

  private initializeDefaultData(): void {
    // Create default permissions
    const permissions = [
      { name: 'game:create', resource: 'game', action: 'create' },
      { name: 'game:edit', resource: 'game', action: 'edit' },
      { name: 'game:delete', resource: 'game', action: 'delete' },
      { name: 'game:join', resource: 'game', action: 'join' },
      { name: 'character:create', resource: 'character', action: 'create' },
      { name: 'character:edit', resource: 'character', action: 'edit' },
      { name: 'character:view', resource: 'character', action: 'view' },
      { name: 'map:edit', resource: 'map', action: 'edit' },
      { name: 'combat:manage', resource: 'combat', action: 'manage' },
      { name: 'users:manage', resource: 'users', action: 'manage' },
    ];

    permissions.forEach(p => {
      const id = `perm_${this.permissionIdCounter++}`;
      this.permissions.set(id, { id, ...p });
    });

    // Create default roles
    const adminPermissions = Array.from(this.permissions.values());
    const gmPermissions = adminPermissions.filter(p => !p.name.startsWith('users:'));
    const playerPermissions = adminPermissions.filter(p => 
      p.name.includes('character:') || p.name === 'game:join'
    );

    this.roles.set('role_1', {
      id: 'role_1',
      name: 'admin',
      permissions: adminPermissions,
    });

    this.roles.set('role_2', {
      id: 'role_2',
      name: 'game_master',
      permissions: gmPermissions,
    });

    this.roles.set('role_3', {
      id: 'role_3',
      name: 'player',
      permissions: playerPermissions,
    });
  }
}
