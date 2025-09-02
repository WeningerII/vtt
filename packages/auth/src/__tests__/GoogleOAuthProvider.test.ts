/**
 * Tests for GoogleOAuthProvider
 */

import { GoogleOAuthProvider, GoogleOAuthConfig } from '../providers/GoogleOAuthProvider';
import { OAuthStateManager, MemoryStateStorage } from '../utils/OAuthStateManager';
import { UserManager } from '@vtt/user-management';

// Mock dependencies
jest.mock('google-auth-library');
jest.mock('@vtt/user-management');
jest.mock('@vtt/logging', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mockOAuth2Client = {
  generateAuthUrl: jest.fn(),
  getToken: jest.fn(),
  setCredentials: jest.fn(),
  verifyIdToken: jest.fn()
};

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => mockOAuth2Client)
}));

describe('GoogleOAuthProvider', () => {
  let provider: GoogleOAuthProvider;
  let mockUserManager: jest.Mocked<UserManager>;
  let stateManager: OAuthStateManager;
  let config: GoogleOAuthConfig;

  beforeEach(() => {
    config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/auth/google/callback'
    };

    mockUserManager = {
      findUserByEmail: jest.fn(),
      findUserByUsername: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      createSession: jest.fn()
    } as any;

    const stateStorage = new MemoryStateStorage();
    stateManager = new OAuthStateManager(stateStorage, 10);
    
    provider = new GoogleOAuthProvider(config, mockUserManager, stateManager);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with state', async () => {
      const expectedUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&scope=openid+email+profile&state=abc123';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = await provider.getAuthorizationUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
        state: expect.any(String),
        prompt: 'consent'
      });
      expect(url).toBe(expectedUrl);
    });

    it('should generate authorization URL with user ID for account linking', async () => {
      const userId = 'user-123';
      const expectedUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&scope=openid+email+profile&state=abc123';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = await provider.getAuthorizationUrl(userId);

      expect(url).toBe(expectedUrl);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    const mockTokens = {
      access_token: 'access-token',
      id_token: 'id-token',
      refresh_token: 'refresh-token'
    };

    const mockPayload = {
      sub: 'google-user-id',
      email: 'test@example.com',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      picture: 'https://example.com/avatar.jpg',
      email_verified: true
    };

    beforeEach(() => {
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload
      });
    });

    it('should handle callback for existing user', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        emailVerified: true
      };
      const mockSession = {
        id: 'session-123',
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      mockUserManager.findUserByEmail.mockReturnValue(existingUser as any);
      mockUserManager.updateUser.mockResolvedValue(existingUser as any);
      mockUserManager.createSession.mockResolvedValue(mockSession as any);

      const result = await provider.handleCallback('auth-code', 'valid-state');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(existingUser);
      expect(result.session).toEqual(mockSession);
      expect(mockUserManager.updateUser).toHaveBeenCalledWith(existingUser.id, {
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: 'https://example.com/avatar.jpg'
      });
    });

    it('should handle callback for new user', async () => {
      const newUser = {
        id: 'user-456',
        email: 'test@example.com',
        username: 'test',
        firstName: 'Test',
        lastName: 'User'
      };
      const mockSession = {
        id: 'session-456',
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      mockUserManager.findUserByEmail.mockReturnValue(undefined);
      mockUserManager.findUserByUsername.mockReturnValue(undefined);
      mockUserManager.createUser.mockResolvedValue(newUser as any);
      mockUserManager.createSession.mockResolvedValue(mockSession as any);

      const result = await provider.handleCallback('auth-code', 'valid-state');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(newUser);
      expect(result.session).toEqual(mockSession);
      expect(mockUserManager.createUser).toHaveBeenCalledWith({
        locale: 'en',
        email: 'test@example.com',
        username: 'test',
        password: expect.any(String),
        firstName: 'Test',
        lastName: 'User'
      });
    });

    it('should handle username collision for new user', async () => {
      const existingUser = { id: 'existing', username: 'test' };
      const newUser = {
        id: 'user-456',
        email: 'test@example.com',
        username: 'test_1',
        firstName: 'Test',
        lastName: 'User'
      };

      mockUserManager.findUserByEmail.mockReturnValue(undefined);
      mockUserManager.findUserByUsername
        .mockReturnValueOnce(existingUser as any) // First call returns existing user
        .mockReturnValueOnce(undefined); // Second call returns undefined
      mockUserManager.createUser.mockResolvedValue(newUser as any);
      mockUserManager.createSession.mockResolvedValue({} as any);

      const result = await provider.handleCallback('auth-code', 'valid-state');

      expect(result.success).toBe(true);
      expect(mockUserManager.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'test_1'
        })
      );
    });

    it('should reject invalid state parameter', async () => {
      const result = await provider.handleCallback('auth-code', 'invalid-state');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid state parameter');
      expect(mockOAuth2Client.getToken).not.toHaveBeenCalled();
    });

    it('should handle token exchange failure', async () => {
      mockOAuth2Client.getToken.mockRejectedValue(new Error('Token exchange failed'));

      const result = await provider.handleCallback('auth-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to exchange authorization code');
    });

    it('should handle invalid token payload', async () => {
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => null
      });

      const result = await provider.handleCallback('auth-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token payload');
    });

    it('should handle user creation failure', async () => {
      mockUserManager.findUserByEmail.mockReturnValue(undefined);
      mockUserManager.findUserByUsername.mockReturnValue(undefined);
      mockUserManager.createUser.mockResolvedValue(undefined as any);

      const result = await provider.handleCallback('auth-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create user account');
    });
  });

  describe('without state manager', () => {
    beforeEach(() => {
      provider = new GoogleOAuthProvider(config, mockUserManager);
    });

    it('should use fallback state generation', async () => {
      const expectedUrl = 'https://accounts.google.com/oauth/authorize';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = await provider.getAuthorizationUrl();

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
        state: expect.stringMatching(/^[a-f0-9]{64}$/),
        prompt: 'consent'
      });
    });

    it('should use fallback state validation', async () => {
      mockOAuth2Client.getToken.mockResolvedValue({ tokens: { id_token: 'token' } });
      mockOAuth2Client.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'user-id',
          email: 'test@example.com',
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'avatar.jpg',
          email_verified: true
        })
      });
      mockUserManager.findUserByEmail.mockReturnValue({ id: 'user-123' } as any);
      mockUserManager.createSession.mockResolvedValue({} as any);

      // Valid 64-character hex string
      const validState = 'a'.repeat(64);
      const result = await provider.handleCallback('auth-code', validState);

      expect(result.success).toBe(true);
    });
  });
});
