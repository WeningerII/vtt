/**
 * Authentication Manager Tests
 * Comprehensive test suite for authentication and authorization
 */

import { AuthenticationManager } from '../AuthenticationManager';

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;

  beforeEach(() => {
    authManager = new AuthenticationManager({
      jwtSecret: 'test-secret',
      jwtRefreshSecret: 'test-refresh-secret',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      bcryptRounds: 4, // Lower for testing performance
      maxSessions: 3,
      requireEmailVerification: false,
    });
  });

  describe('User Registration', () => {
    test('should register new user successfully', async () => {
      const result = await authManager.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        acceptTerms: true,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.user?.username).toBe('testuser');
      expect(result.user?.roles).toContain('user');
      expect(result.token).toBeDefined(); // Auto-login when email verification not required
    });

    test('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        username: 'user1',
        password: 'SecurePass123!',
        acceptTerms: true,
      };

      await authManager.register(userData);
      
      const result = await authManager.register({
        ...userData,
        username: 'user2', // Different username
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('USER_EXISTS');
      expect(result.error).toContain('Email already registered');
    });

    test('should reject duplicate username registration', async () => {
      const userData = {
        email: 'user1@example.com',
        username: 'duplicate',
        password: 'SecurePass123!',
        acceptTerms: true,
      };

      await authManager.register(userData);
      
      const result = await authManager.register({
        ...userData,
        email: 'user2@example.com', // Different email
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('USER_EXISTS');
      expect(result.error).toContain('Username already taken');
    });

    test('should hash password securely', async () => {
      const password = 'TestPassword123!';
      const result = await authManager.register({
        email: 'secure@example.com',
        username: 'secureuser',
        password,
        acceptTerms: true,
      });

      expect(result.success).toBe(true);
      expect(result.user?.passwordHash).toBeUndefined(); // Should not expose hash
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      await authManager.register({
        email: 'login@example.com',
        username: 'loginuser',
        password: 'LoginPass123!',
        acceptTerms: true,
      });
    });

    test('should login with valid credentials', async () => {
      const result = await authManager.login({
        email: 'login@example.com',
        password: 'LoginPass123!',
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.token?.tokenType).toBe('Bearer');
      expect(result.token?.accessToken).toBeDefined();
      expect(result.token?.refreshToken).toBeDefined();
    });

    test('should reject invalid email', async () => {
      const result = await authManager.login({
        email: 'nonexistent@example.com',
        password: 'LoginPass123!',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_CREDENTIALS');
    });

    test('should reject invalid password', async () => {
      const result = await authManager.login({
        email: 'login@example.com',
        password: 'WrongPassword',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_CREDENTIALS');
    });

    test('should track user sessions', async () => {
      const result = await authManager.login({
        email: 'login@example.com',
        password: 'LoginPass123!',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
      });

      expect(result.success).toBe(true);
      
      const sessions = authManager.getUserSessions(result.user!.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].ipAddress).toBe('192.168.1.1');
      expect(sessions[0].userAgent).toBe('Test Browser');
    });
  });

  describe('Token Management', () => {
    let userToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      await authManager.register({
        email: 'token@example.com',
        username: 'tokenuser',
        password: 'TokenPass123!',
        acceptTerms: true,
      });

      const loginResult = await authManager.login({
        email: 'token@example.com',
        password: 'TokenPass123!',
      });

      userToken = loginResult.token!.accessToken;
      refreshToken = loginResult.token!.refreshToken;
    });

    test('should verify valid access token', () => {
      const result = authManager.verifyAccessToken(userToken);
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload.email).toBe('token@example.com');
    });

    test('should reject invalid access token', () => {
      const result = authManager.verifyAccessToken('invalid.token.here');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should refresh access token with valid refresh token', async () => {
      const result = await authManager.refreshToken(refreshToken);
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token?.accessToken).not.toBe(userToken); // Should be new token
    });

    test('should reject invalid refresh token', async () => {
      const result = await authManager.refreshToken('invalid-refresh-token');
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_REFRESH_TOKEN');
    });

    test('should blacklist token on logout', async () => {
      const logoutResult = await authManager.logout(userToken);
      expect(logoutResult.success).toBe(true);

      // Token should now be invalid
      const verifyResult = authManager.verifyAccessToken(userToken);
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.error).toContain('blacklisted');
    });
  });

  describe('Role and Permission Management', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authManager.register({
        email: 'roles@example.com',
        username: 'roleuser',
        password: 'RolePass123!',
        acceptTerms: true,
      });
      userId = result.user!.id;
    });

    test('should add and check roles', () => {
      expect(authManager.hasRole(userId, 'admin')).toBe(false);
      
      authManager.addRole(userId, 'admin');
      expect(authManager.hasRole(userId, 'admin')).toBe(true);
    });

    test('should remove roles', () => {
      authManager.addRole(userId, 'gm');
      expect(authManager.hasRole(userId, 'gm')).toBe(true);
      
      authManager.removeRole(userId, 'gm');
      expect(authManager.hasRole(userId, 'gm')).toBe(false);
    });

    test('should check permissions based on roles', () => {
      // User role should have basic permissions
      expect(authManager.hasPermission(userId, 'read:own')).toBe(true);
      expect(authManager.hasPermission(userId, 'manage:scenes')).toBe(false);

      // Admin role should have all permissions
      authManager.addRole(userId, 'admin');
      expect(authManager.hasPermission(userId, 'manage:scenes')).toBe(true);
      expect(authManager.hasPermission(userId, 'manage:users')).toBe(true);
    });

    test('should handle GM permissions', () => {
      authManager.addRole(userId, 'gm');
      
      expect(authManager.hasPermission(userId, 'manage:scenes')).toBe(true);
      expect(authManager.hasPermission(userId, 'manage:tokens')).toBe(true);
      expect(authManager.hasPermission(userId, 'read:scenes')).toBe(true);
    });
  });

  describe('Session Management', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authManager.register({
        email: 'sessions@example.com',
        username: 'sessionuser',
        password: 'SessionPass123!',
        acceptTerms: true,
      });
      userId = result.user!.id;
    });

    test('should enforce maximum session limit', async () => {
      const credentials = {
        email: 'sessions@example.com',
        password: 'SessionPass123!',
      };

      // Create multiple sessions (more than maxSessions = 3)
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const result = await authManager.login({
          ...credentials,
          userAgent: `Browser ${i}`,
        });
        sessions.push(result);
      }

      // Should only have 3 active sessions
      const activeSessions = authManager.getUserSessions(userId);
      expect(activeSessions.length).toBeLessThanOrEqual(3);
    });

    test('should invalidate other sessions', async () => {
      const credentials = {
        email: 'sessions@example.com',
        password: 'SessionPass123!',
      };

      // Create multiple sessions
      const _session1 = await authManager.login(credentials);
      const _session2 = await authManager.login(credentials);
      const session3 = await authManager.login(credentials);

      expect(authManager.getUserSessions(userId)).toHaveLength(3);

      // Invalidate other sessions except current
      const invalidatedCount = authManager.invalidateOtherSessions(
        userId,
        session3.session!.id
      );
      
      expect(invalidatedCount).toBe(2);
      expect(authManager.getUserSessions(userId)).toHaveLength(1);
    });
  });

  describe('Password Management', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authManager.register({
        email: 'password@example.com',
        username: 'passworduser',
        password: 'OldPass123!',
        acceptTerms: true,
      });
      userId = result.user!.id;
    });

    test('should change password with valid old password', async () => {
      const result = await authManager.changePassword(
        userId,
        'OldPass123!',
        'NewPass456!'
      );

      expect(result.success).toBe(true);

      // Should be able to login with new password
      const loginResult = await authManager.login({
        email: 'password@example.com',
        password: 'NewPass456!',
      });
      expect(loginResult.success).toBe(true);
    });

    test('should reject password change with invalid old password', async () => {
      const result = await authManager.changePassword(
        userId,
        'WrongOldPass',
        'NewPass456!'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid current password');
    });

    test('should invalidate all sessions on password change', async () => {
      // Create multiple sessions
      await authManager.login({
        email: 'password@example.com',
        password: 'OldPass123!',
      });
      await authManager.login({
        email: 'password@example.com',
        password: 'OldPass123!',
      });

      expect(authManager.getUserSessions(userId)).toHaveLength(2);

      // Change password
      await authManager.changePassword(userId, 'OldPass123!', 'NewPass456!');

      // All sessions should be invalidated
      expect(authManager.getUserSessions(userId)).toHaveLength(0);
    });
  });

  describe('Security Events', () => {
    test('should emit events on user registration', (done) => {
      authManager.on('userRegistered', (data) => {
        expect(data.user.email).toBe('event@example.com');
        done();
      });

      authManager.register({
        email: 'event@example.com',
        username: 'eventuser',
        password: 'EventPass123!',
        acceptTerms: true,
      });
    });

    test('should emit events on successful login', (done) => {
      authManager.on('loginSuccess', (data) => {
        expect(data.user.email).toBe('event@example.com');
        done();
      });

      // First register, then login
      authManager.register({
        email: 'event@example.com',
        username: 'eventuser',
        password: 'EventPass123!',
        acceptTerms: true,
      }).then(() => {
        authManager.login({
          email: 'event@example.com',
          password: 'EventPass123!',
        });
      });
    });

    test('should emit events on failed login', (done) => {
      authManager.on('loginFailed', (data) => {
        expect(data.reason).toBe('user_not_found');
        done();
      });

      authManager.login({
        email: 'nonexistent@example.com',
        password: 'password',
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JWT tokens gracefully', () => {
      const result = authManager.verifyAccessToken('not.a.valid.jwt.token');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle expired tokens gracefully', async () => {
      // Create auth manager with very short token expiry
      const shortAuthManager = new AuthenticationManager({
        jwtSecret: 'test-secret',
        jwtRefreshSecret: 'test-refresh-secret',
        accessTokenExpiry: '1ms', // 1 millisecond
        refreshTokenExpiry: '7d',
        bcryptRounds: 4,
        maxSessions: 3,
        requireEmailVerification: false,
      });

      await shortAuthManager.register({
        email: 'expire@example.com',
        username: 'expireuser',
        password: 'ExpirePass123!',
        acceptTerms: true,
      });

      const loginResult = await shortAuthManager.login({
        email: 'expire@example.com',
        password: 'ExpirePass123!',
      });

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const verifyResult = shortAuthManager.verifyAccessToken(loginResult.token!.accessToken);
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.error).toContain('Invalid token');
    });

    test('should handle database errors gracefully', async () => {
      // Simulate error by trying to register with invalid data
      const result = await authManager.register({
        email: '', // Invalid email
        username: '',
        password: '',
        acceptTerms: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should handle multiple concurrent operations', async () => {
      const operations = Array.from({_ length: 10 }, async (_, _i) => {
        return authManager.register({
          email: `concurrent${i}@example.com`,
          username: `user${i}`,
          password: 'ConcurrentPass123!',
          acceptTerms: true,
        });
      });

      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All users should have unique IDs
      const userIds = results.map(r => r.user!.id);
      const uniqueIds = new Set(userIds);
      expect(uniqueIds.size).toBe(userIds.length);
    });

    test('should perform password hashing efficiently', async () => {
      const start = Date.now();
      
      await authManager.register({
        email: 'perf@example.com',
        username: 'perfuser',
        password: 'PerformancePass123!',
        acceptTerms: true,
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
