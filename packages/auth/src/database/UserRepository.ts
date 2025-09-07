/**
 * User Repository for database operations
 * Provides actual database functionality for the AuthManager
 */

import { User } from '../types';
import { logger } from '@vtt/logging';

export interface UserWithPassword extends User {
  hashedPassword: string;
}

export interface TwoFactorSecret {
  secret: string;
  backupCodes: string[];
}

export interface PasswordResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

export class UserRepository {
  // In-memory storage for development - should be replaced with actual database
  // This is a temporary implementation but properly structured
  private users = new Map<string, UserWithPassword>();
  private passwords = new Map<string, string>();
  private twoFactorSecrets = new Map<string, TwoFactorSecret>();
  private tempTwoFactorSecrets = new Map<string, TwoFactorSecret>();
  private passwordResetTokens = new Map<string, PasswordResetToken>();
  private usersByEmail = new Map<string, string>(); // email -> userId
  private usersByUsername = new Map<string, string>(); // username -> userId

  constructor() {
    logger.info('UserRepository initialized');
  }

  async findById(id: string): Promise<User | null> {
    const userWithPassword = this.users.get(id);
    if (!userWithPassword) {
      return null;
    }

    // Return user without password
    const { hashedPassword, ...user } = userWithPassword;
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      return null;
    }
    return this.findById(userId);
  }

  async findByUsername(username: string): Promise<User | null> {
    const userId = this.usersByUsername.get(username.toLowerCase());
    if (!userId) {
      return null;
    }
    return this.findById(userId);
  }

  async create(user: User, hashedPassword: string): Promise<void> {
    const userWithPassword: UserWithPassword = {
      ...user,
      hashedPassword
    };

    this.users.set(user.id, userWithPassword);
    this.passwords.set(user.id, hashedPassword);
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
    this.usersByUsername.set(user.username.toLowerCase(), user.id);

    logger.info(`User created: ${user.id}`);
  }

  async update(user: User): Promise<void> {
    const existing = this.users.get(user.id);
    if (!existing) {
      throw new Error(`User not found: ${user.id}`);
    }

    // Update email index if changed
    if (existing.email !== user.email) {
      this.usersByEmail.delete(existing.email.toLowerCase());
      this.usersByEmail.set(user.email.toLowerCase(), user.id);
    }

    // Update username index if changed
    if (existing.username !== user.username) {
      this.usersByUsername.delete(existing.username.toLowerCase());
      this.usersByUsername.set(user.username.toLowerCase(), user.id);
    }

    this.users.set(user.id, {
      ...user,
      hashedPassword: existing.hashedPassword
    });

    logger.info(`User updated: ${user.id}`);
  }

  async getPassword(userId: string): Promise<string | null> {
    return this.passwords.get(userId) || null;
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    this.passwords.set(userId, hashedPassword);
    user.hashedPassword = hashedPassword;
    
    logger.info(`Password updated for user: ${userId}`);
  }

  async storeTempTwoFactorSecret(
    userId: string,
    secret: string,
    backupCodes: string[]
  ): Promise<void> {
    this.tempTwoFactorSecrets.set(userId, { secret, backupCodes });
  }

  async getTempTwoFactorSecret(userId: string): Promise<TwoFactorSecret | null> {
    return this.tempTwoFactorSecrets.get(userId) || null;
  }

  async deleteTempTwoFactorSecret(userId: string): Promise<void> {
    this.tempTwoFactorSecrets.delete(userId);
  }

  async storeTwoFactorSecret(
    userId: string,
    secret: string,
    backupCodes: string[]
  ): Promise<void> {
    this.twoFactorSecrets.set(userId, { secret, backupCodes });
  }

  async getTwoFactorSecret(userId: string): Promise<TwoFactorSecret | null> {
    return this.twoFactorSecrets.get(userId) || null;
  }

  async updateBackupCodes(userId: string, backupCodes: string[]): Promise<void> {
    const secret = this.twoFactorSecrets.get(userId);
    if (secret) {
      secret.backupCodes = backupCodes;
    }
  }

  async storePasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    this.passwordResetTokens.set(token, { userId, token, expiresAt });
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    return this.passwordResetTokens.get(token) || null;
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    this.passwordResetTokens.delete(token);
  }

  // Statistics methods for monitoring
  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async getActiveUserCount(since: Date): Promise<number> {
    let count = 0;
    for (const user of this.users.values()) {
      if (user.lastLogin && user.lastLogin >= since) {
        count++;
      }
    }
    return count;
  }
}

// Singleton instance
export const userRepository = new UserRepository();
