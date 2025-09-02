/**
 * Tests for OAuthStateManager
 */

import { OAuthStateManager, MemoryStateStorage, OAuthState } from '../utils/OAuthStateManager';

jest.mock('@vtt/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('OAuthStateManager', () => {
  let stateManager: OAuthStateManager;
  let storage: MemoryStateStorage;

  beforeEach(() => {
    storage = new MemoryStateStorage();
    stateManager = new OAuthStateManager(storage, 1); // 1 minute TTL for testing
  });

  describe('generateState', () => {
    it('should generate a valid state parameter', async () => {
      const state = await stateManager.generateState('google');

      expect(state).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should store state with correct properties', async () => {
      const state = await stateManager.generateState('google', 'user-123');
      const storedState = await storage.retrieve(state);

      expect(storedState).toMatchObject({
        value: state,
        provider: 'google',
        userId: 'user-123',
        used: false
      });
      expect(storedState?.createdAt).toBeInstanceOf(Date);
      expect(storedState?.expiresAt).toBeInstanceOf(Date);
      expect(storedState?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate unique states', async () => {
      const state1 = await stateManager.generateState('google');
      const state2 = await stateManager.generateState('google');

      expect(state1).not.toBe(state2);
    });
  });

  describe('validateState', () => {
    it('should validate correct state', async () => {
      const state = await stateManager.generateState('google', 'user-123');
      const isValid = await stateManager.validateState(state, 'google', 'user-123');

      expect(isValid).toBe(true);
    });

    it('should reject non-existent state', async () => {
      const isValid = await stateManager.validateState('nonexistent', 'google');

      expect(isValid).toBe(false);
    });

    it('should reject already used state', async () => {
      const state = await stateManager.generateState('google');
      
      // First validation should succeed
      const firstValidation = await stateManager.validateState(state, 'google');
      expect(firstValidation).toBe(true);

      // Second validation should fail
      const secondValidation = await stateManager.validateState(state, 'google');
      expect(secondValidation).toBe(false);
    });

    it('should reject expired state', async () => {
      // Create state manager with very short TTL
      const shortTtlManager = new OAuthStateManager(storage, 0.001); // ~60ms
      const state = await shortTtlManager.generateState('google');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const isValid = await shortTtlManager.validateState(state, 'google');
      expect(isValid).toBe(false);
    });

    it('should reject provider mismatch', async () => {
      const state = await stateManager.generateState('google');
      const isValid = await stateManager.validateState(state, 'discord');

      expect(isValid).toBe(false);
    });

    it('should reject user ID mismatch', async () => {
      const state = await stateManager.generateState('google', 'user-123');
      const isValid = await stateManager.validateState(state, 'google', 'user-456');

      expect(isValid).toBe(false);
    });

    it('should allow validation without user ID when state has no user ID', async () => {
      const state = await stateManager.generateState('google');
      const isValid = await stateManager.validateState(state, 'google');

      expect(isValid).toBe(true);
    });

    it('should allow validation with user ID when state has no user ID', async () => {
      const state = await stateManager.generateState('google');
      const isValid = await stateManager.validateState(state, 'google', 'user-123');

      expect(isValid).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove expired states', async () => {
      const shortTtlManager = new OAuthStateManager(storage, 0.001);
      const state = await shortTtlManager.generateState('google');

      // Verify state exists
      let storedState = await storage.retrieve(state);
      expect(storedState).toBeTruthy();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Run cleanup
      await shortTtlManager.cleanup();

      // Verify state is removed
      storedState = await storage.retrieve(state);
      expect(storedState).toBeNull();
    });

    it('should remove used states', async () => {
      const state = await stateManager.generateState('google');
      
      // Use the state
      await stateManager.validateState(state, 'google');

      // Run cleanup
      await stateManager.cleanup();

      // Verify state is removed
      const storedState = await storage.retrieve(state);
      expect(storedState).toBeNull();
    });

    it('should keep valid unexpired states', async () => {
      const state = await stateManager.generateState('google');

      // Run cleanup
      await stateManager.cleanup();

      // Verify state still exists
      const storedState = await storage.retrieve(state);
      expect(storedState).toBeTruthy();
    });
  });

  describe('getStateInfo', () => {
    it('should return state info without consuming it', async () => {
      const state = await stateManager.generateState('google', 'user-123');
      const info = await stateManager.getStateInfo(state);

      expect(info).toMatchObject({
        provider: 'google',
        userId: 'user-123',
        used: false
      });
      expect(info?.createdAt).toBeInstanceOf(Date);
      expect(info?.expiresAt).toBeInstanceOf(Date);

      // Verify state is still valid after getting info
      const isValid = await stateManager.validateState(state, 'google', 'user-123');
      expect(isValid).toBe(true);
    });

    it('should return null for non-existent state', async () => {
      const info = await stateManager.getStateInfo('nonexistent');
      expect(info).toBeNull();
    });
  });
});

describe('MemoryStateStorage', () => {
  let storage: MemoryStateStorage;

  beforeEach(() => {
    storage = new MemoryStateStorage();
  });

  it('should store and retrieve states', async () => {
    const state: OAuthState = {
      value: 'test-state',
      provider: 'google',
      userId: 'user-123',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      used: false
    };

    await storage.store('test-key', state);
    const retrieved = await storage.retrieve('test-key');

    expect(retrieved).toEqual(state);
  });

  it('should return null for non-existent keys', async () => {
    const retrieved = await storage.retrieve('nonexistent');
    expect(retrieved).toBeNull();
  });

  it('should delete states', async () => {
    const state: OAuthState = {
      value: 'test-state',
      provider: 'google',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      used: false
    };

    await storage.store('test-key', state);
    await storage.delete('test-key');
    
    const retrieved = await storage.retrieve('test-key');
    expect(retrieved).toBeNull();
  });

  it('should cleanup expired and used states', async () => {
    const expiredState: OAuthState = {
      value: 'expired-state',
      provider: 'google',
      createdAt: new Date(Date.now() - 120000),
      expiresAt: new Date(Date.now() - 60000),
      used: false
    };

    const usedState: OAuthState = {
      value: 'used-state',
      provider: 'google',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      used: true
    };

    const validState: OAuthState = {
      value: 'valid-state',
      provider: 'google',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      used: false
    };

    await storage.store('expired', expiredState);
    await storage.store('used', usedState);
    await storage.store('valid', validState);

    await storage.cleanup();

    expect(await storage.retrieve('expired')).toBeNull();
    expect(await storage.retrieve('used')).toBeNull();
    expect(await storage.retrieve('valid')).toBeTruthy();
  });
});
