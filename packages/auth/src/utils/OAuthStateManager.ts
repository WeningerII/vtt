/**
 * OAuth State Management Utility
 * Provides secure state parameter generation, storage, and validation
 */

import * as crypto from 'crypto';
import { logger } from '@vtt/logging';

export interface OAuthState {
  value: string;
  provider: string;
  userId?: string | undefined;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

export interface StateStorage {
  store(key: string, state: OAuthState): Promise<void>;
  retrieve(key: string): Promise<OAuthState | null>;
  delete(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * In-memory state storage (for development/testing)
 */
export class MemoryStateStorage implements StateStorage {
  private states = new Map<string, OAuthState>();

  async store(key: string, state: OAuthState): Promise<void> {
    this.states.set(key, state);
  }

  async retrieve(key: string): Promise<OAuthState | null> {
    return this.states.get(key) || null;
  }

  async delete(key: string): Promise<void> {
    this.states.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    for (const [key, state] of this.states.entries()) {
      if (state.expiresAt < now || state.used) {
        this.states.delete(key);
      }
    }
  }
}

/**
 * Redis state storage (for production)
 */
export class RedisStateStorage implements StateStorage {
  private redis: any;

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async store(key: string, state: OAuthState): Promise<void> {
    const ttl = Math.floor((state.expiresAt.getTime() - Date.now()) / 1000);
    await this.redis.setex(`oauth_state:${key}`, ttl, JSON.stringify(state));
  }

  async retrieve(key: string): Promise<OAuthState | null> {
    const data = await this.redis.get(`oauth_state:${key}`);
    if (!data) return null;
    
    const state = JSON.parse(data);
    return {
      ...state,
      createdAt: new Date(state.createdAt),
      expiresAt: new Date(state.expiresAt)
    };
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`oauth_state:${key}`);
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL automatically, but we can clean up used states
    const keys = await this.redis.keys('oauth_state:*');
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const state = JSON.parse(data);
        if (state.used) {
          await this.redis.del(key);
        }
      }
    }
  }
}

export class OAuthStateManager {
  private storage: StateStorage;
  private defaultTtlMinutes: number;

  constructor(storage: StateStorage, ttlMinutes: number = 10) {
    this.storage = storage;
    this.defaultTtlMinutes = ttlMinutes;
  }

  /**
   * Generate a new OAuth state parameter
   */
  async generateState(provider: string, userId?: string): Promise<string> {
    const stateValue = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultTtlMinutes * 60 * 1000);

    const state: OAuthState = {
      value: stateValue,
      provider,
      userId,
      createdAt: now,
      expiresAt,
      used: false
    };

    await this.storage.store(stateValue, state);
    
    logger.debug('Generated OAuth state', { 
      provider, 
      userId: userId ? '[REDACTED]' : undefined,
      expiresAt 
    });

    return stateValue;
  }

  /**
   * Validate and consume an OAuth state parameter
   */
  async validateState(stateValue: string, provider: string, userId?: string): Promise<boolean> {
    try {
      const state = await this.storage.retrieve(stateValue);
      
      if (!state) {
        logger.warn('OAuth state not found', { stateValue: '[REDACTED]', provider });
        return false;
      }

      // Check if already used
      if (state.used) {
        logger.warn('OAuth state already used', { provider });
        await this.storage.delete(stateValue);
        return false;
      }

      // Check if expired
      if (state.expiresAt < new Date()) {
        logger.warn('OAuth state expired', { provider, expiresAt: state.expiresAt });
        await this.storage.delete(stateValue);
        return false;
      }

      // Check provider match
      if (state.provider !== provider) {
        logger.warn('OAuth state provider mismatch', { 
          expected: provider, 
          actual: state.provider 
        });
        await this.storage.delete(stateValue);
        return false;
      }

      // Check user ID match if provided
      if (userId && state.userId && state.userId !== userId) {
        logger.warn('OAuth state user ID mismatch', { provider });
        await this.storage.delete(stateValue);
        return false;
      }

      // Mark as used and delete
      state.used = true;
      await this.storage.delete(stateValue);

      logger.debug('OAuth state validated successfully', { provider });
      return true;

    } catch (error) {
      logger.error('OAuth state validation error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        provider 
      });
      return false;
    }
  }

  /**
   * Clean up expired states
   */
  async cleanup(): Promise<void> {
    await this.storage.cleanup();
  }

  /**
   * Get state info without consuming it (for debugging)
   */
  async getStateInfo(stateValue: string): Promise<Omit<OAuthState, 'value'> | null> {
    const state = await this.storage.retrieve(stateValue);
    if (!state) return null;
    
    const { value, ...info } = state;
    return info;
  }
}
