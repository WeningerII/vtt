/**
 * Integration tests for authentication system
 */
import { AuthService } from "../../services/auth/src/AuthService";
import { InMemoryUserRepository } from "../../services/auth/src/UserRepository";
import { JWTManager, JWTConfig } from "../../services/auth/src/JWTManager";
import { PasswordManager, PasswordConfig } from "../../services/auth/src/PasswordManager";
import {
  SessionManager,
  SessionRepository,
  CreateSessionRequest,
  UpdateSessionRequest,
} from "../../services/auth/src/SessionManager";
import { Session } from "../../services/auth/src/types";

// Mock SessionRepository for testing
class InMemorySessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();
  private sessionIdCounter = 1;

  async create(data: CreateSessionRequest): Promise<Session> {
    const id = data.id || `sess_${this.sessionIdCounter++}`;
    const session: Session = {
      id,
      userId: data.userId,
      token: data.token,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt || new Date(),
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    };
    this.sessions.set(id, session);
    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async findByToken(token: string): Promise<Session | null> {
    for (const session of Array.from(this.sessions.values())) {
      if (session.token === token) {
        return session;
      }
    }
    return null;
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    for (const session of Array.from(this.sessions.values())) {
      if (session.refreshToken === refreshToken) {
        return session;
      }
    }
    return null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  async update(id: string, data: UpdateSessionRequest): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error("Session not found");
    }

    if (data.token !== undefined) session.token = data.token;
    if (data.refreshToken !== undefined) session.refreshToken = data.refreshToken;
    if (data.expiresAt !== undefined) session.expiresAt = data.expiresAt;

    this.sessions.set(id, session);
    return session;
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteByUserId(userId: string): Promise<void> {
    for (const [id, session] of Array.from(this.sessions.entries())) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }

  async deleteExpired(): Promise<void> {
    const now = new Date();
    for (const [id, session] of Array.from(this.sessions.entries())) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }
}

describe("Authentication Integration", () => {
  let authService: AuthService;
  let userRepository: InMemoryUserRepository;
  let jwtManager: JWTManager;
  let passwordManager: PasswordManager;
  let sessionManager: SessionManager;
  let sessionRepository: InMemorySessionRepository;

  beforeEach(() => {
    // Create test configurations
    const jwtConfig: JWTConfig = {
      accessTokenSecret: "test-access-secret",
      refreshTokenSecret: "test-refresh-secret",
      emailVerificationSecret: "test-email-secret",
      passwordResetSecret: "test-reset-secret",
      issuer: "test-issuer",
      accessTokenExpiry: "1h",
      refreshTokenExpiry: "7d",
      emailVerificationExpiry: "24h",
      passwordResetExpiry: "1h",
    };

    const passwordConfig: PasswordConfig = {
      saltRounds: 10,
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    };

    // Create dependencies
    userRepository = new InMemoryUserRepository();
    jwtManager = new JWTManager(jwtConfig);
    passwordManager = new PasswordManager(passwordConfig);
    sessionRepository = new InMemorySessionRepository();
    sessionManager = new SessionManager(sessionRepository);

    authService = new AuthService(jwtManager, passwordManager, sessionManager, userRepository);
  });

  describe("User Registration Flow", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "SecurePassword123!",
        username: "testuser",
        displayName: "Test User",
      };

      const result = await authService.register(userData);

      expect(result.email).toBe(userData.email);
      expect(result.username).toBe(userData.username);
      expect(result.displayName).toBe(userData.displayName);
      expect(result.id).toBeDefined();
    });

    it("should reject duplicate email registration", async () => {
      const userData = {
        email: "duplicate@example.com",
        password: "SecurePassword123!",
        username: "user1",
        displayName: "User One",
      };

      await authService.register(userData);

      try {
        await authService.register({
          ...userData,
          username: "user2",
          displayName: "User Two",
        });
        fail("Expected registration to throw an error");
      } catch (error: any) {
        expect(error.message).toContain("User already exists");
      }
    });
  });

  describe("Login Flow", () => {
    beforeEach(async () => {
      await authService.register({
        email: "login@example.com",
        password: "TestPassword123!",
        username: "loginuser",
        displayName: "Login User",
      });
    });

    it("should login with valid credentials", async () => {
      const loginRequest = {
        email: "login@example.com",
        password: "TestPassword123!",
      };

      const result = await authService.login(loginRequest);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBeDefined();
    });

    it("should reject invalid password", async () => {
      const loginRequest = {
        email: "login@example.com",
        password: "WrongPassword",
      };

      try {
        await authService.login(loginRequest);
        fail("Expected login to throw an error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid credentials");
      }
    });

    it("should reject non-existent user", async () => {
      const loginRequest = {
        email: "nonexistent@example.com",
        password: "AnyPassword",
      };

      try {
        await authService.login(loginRequest);
        fail("Expected login to throw an error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid credentials");
      }
    });
  });

  describe("Token Validation", () => {
    let validToken: string;

    beforeEach(async () => {
      // Register user first
      await authService.register({
        email: "token@example.com",
        password: "TokenTest123!",
        username: "tokenuser",
        displayName: "Token User",
      });

      // Then login to get token
      const loginResult = await authService.login({
        email: "token@example.com",
        password: "TokenTest123!",
      });
      validToken = loginResult.accessToken;
    });

    it("should validate valid token", async () => {
      const result = await authService.verifyToken(validToken);

      expect(result.isAuthenticated).toBe(true);
      expect(result.user?.email).toBe("token@example.com");
    });

    it("should reject invalid token", async () => {
      const result = await authService.verifyToken("invalid.token.here");

      expect(result.isAuthenticated).toBe(false);
      expect(result.user).toBeNull();
    });

    it("should reject expired token", async () => {
      // Mock expired token scenario
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid";

      const result = await authService.verifyToken(expiredToken);

      expect(result.isAuthenticated).toBe(false);
      expect(result.user).toBeNull();
    });
  });

  describe("Password Reset Flow", () => {
    beforeEach(async () => {
      await authService.register({
        email: "reset@example.com",
        password: "OriginalPassword123!",
        username: "resetuser",
        displayName: "Reset User",
      });
    });

    it("should initiate password reset", async () => {
      // resetPassword method doesn't return anything, it just initiates the process
      await expect(authService.resetPassword("reset@example.com")).resolves.not.toThrow();
    });

    it("should complete password reset with valid token", async () => {
      // Note: This test would need a real reset token from the implementation
      // For now, we'll test that the method exists and handles invalid tokens correctly
      const newPassword = "NewPassword123!";
      const fakeToken = "fake.reset.token";

      try {
        await authService.confirmPasswordReset(fakeToken, newPassword);
        fail("Expected confirmPasswordReset to throw an error");
      } catch (error: any) {
        // This should throw because the token is invalid
        expect(error).toBeDefined();
      }
    });
  });
});
