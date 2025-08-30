/**
 * Integration tests for authentication system
 */
import { AuthService } from '../../services/auth/src/AuthService';
import { UserRepository } from '../../services/auth/src/UserRepository';

describe('Authentication Integration', () => {
  let authService: AuthService;
  let userRepository: UserRepository;

  beforeEach(() => {
    userRepository = new UserRepository();
    authService = new AuthService(userRepository);
  });

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        username: 'testuser'
      };

      const result = await authService.register(userData);
      
      expect(result.success).toBe(true);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.username).toBe(userData.username);
      expect(result.token).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        username: 'user1'
      };

      await authService.register(userData);
      
      const duplicateResult = await authService.register({
        ...userData,
        username: 'user2'
      });

      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.error).toContain('email already exists');
    });
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'TestPassword123!',
        username: 'loginuser'
      });
    });

    it('should login with valid credentials', async () => {
      const result = await authService.login('login@example.com', 'TestPassword123!');
      
      expect(result.success).toBe(true);
      expect(result.user.email).toBe('login@example.com');
      expect(result.token).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const result = await authService.login('login@example.com', 'WrongPassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const result = await authService.login('nonexistent@example.com', 'AnyPassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });
  });

  describe('Token Validation', () => {
    let validToken: string;

    beforeEach(async () => {
      const registerResult = await authService.register({
        email: 'token@example.com',
        password: 'TokenTest123!',
        username: 'tokenuser'
      });
      validToken = registerResult.token;
    });

    it('should validate valid token', async () => {
      const result = await authService.validateToken(validToken);
      
      expect(result.valid).toBe(true);
      expect(result.user.email).toBe('token@example.com');
    });

    it('should reject invalid token', async () => {
      const result = await authService.validateToken('invalid.token.here');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject expired token', async () => {
      // Mock expired token scenario
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
      
      const result = await authService.validateToken(expiredToken);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('Password Reset Flow', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'reset@example.com',
        password: 'OriginalPassword123!',
        username: 'resetuser'
      });
    });

    it('should initiate password reset', async () => {
      const result = await authService.initiatePasswordReset('reset@example.com');
      
      expect(result.success).toBe(true);
      expect(result.resetToken).toBeDefined();
    });

    it('should complete password reset with valid token', async () => {
      const resetResult = await authService.initiatePasswordReset('reset@example.com');
      const newPassword = 'NewPassword123!';
      
      const completeResult = await authService.completePasswordReset(
        resetResult.resetToken,
        newPassword
      );
      
      expect(completeResult.success).toBe(true);
      
      // Verify can login with new password
      const loginResult = await authService.login('reset@example.com', newPassword);
      expect(loginResult.success).toBe(true);
    });
  });
});
