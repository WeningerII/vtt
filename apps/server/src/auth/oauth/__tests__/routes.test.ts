/**
 * Tests for OAuth Routes
 */

// eslint-disable-next-line import/no-unresolved
import request from "supertest";
import express from "express";
import session from "express-session";
import { createOAuthRoutes } from "../routes";

// Mock dependencies
jest.mock("@vtt/auth");
jest.mock("@vtt/user-management");
jest.mock("@vtt/logging", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGoogleProvider = {
  getAuthorizationUrl: jest.fn(),
  handleCallback: jest.fn(),
};

const mockDiscordProvider = {
  getAuthorizationUrl: jest.fn(),
  handleCallback: jest.fn(),
};

const mockStateManager = {
  generateState: jest.fn(),
  validateState: jest.fn(),
  cleanup: jest.fn(),
};

jest.mock("@vtt/auth", () => ({
  GoogleOAuthProvider: jest.fn().mockImplementation(() => mockGoogleProvider),
  DiscordOAuthProvider: jest.fn().mockImplementation(() => mockDiscordProvider),
  OAuthStateManager: jest.fn().mockImplementation(() => mockStateManager),
  MemoryStateStorage: jest.fn().mockImplementation(() => ({})),
}));

describe("OAuth Routes", () => {
  let app;
  /** @type {{ findUserByEmail: jest.Mock; createUser: jest.Mock; createSession: jest.Mock }} */
  let mockUserManager;

  beforeEach(() => {
    // Setup Express app with session middleware
    app = express();
    app.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      }),
    );

    mockUserManager = {
      findUserByEmail: jest.fn(),
      createUser: jest.fn(),
      createSession: jest.fn(),
    };

    // Setup OAuth routes
    const oauthRoutes = createOAuthRoutes(mockUserManager);
    app.use(oauthRoutes);

    // Reset mocks
    jest.clearAllMocks();

    // Setup environment variables
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    process.env.GOOGLE_CALLBACK_URL = "http://localhost:3001/auth/google/callback";
    process.env.DISCORD_CLIENT_ID = "test-discord-client-id";
    process.env.DISCORD_CLIENT_SECRET = "test-discord-client-secret";
    process.env.DISCORD_REDIRECT_URI = "http://localhost:3000/auth/discord/callback";
    process.env.CLIENT_URL = "http://localhost:3000";
  });

  describe("GET /auth/google", () => {
    it("should redirect to Google OAuth URL", async () => {
      const authUrl =
        "https://accounts.google.com/oauth/authorize?client_id=test&scope=openid+email+profile&state=abc123";
      mockGoogleProvider.getAuthorizationUrl.mockResolvedValue(authUrl);

      const response = await request(app).get("/auth/google").expect(302);

      expect(response.headers.location).toBe(authUrl);
      expect(mockGoogleProvider.getAuthorizationUrl).toHaveBeenCalledWith(undefined);
    });

    it("should redirect to Google OAuth URL with user ID for account linking", async () => {
      const authUrl =
        "https://accounts.google.com/oauth/authorize?client_id=test&scope=openid+email+profile&state=abc123";
      mockGoogleProvider.getAuthorizationUrl.mockResolvedValue(authUrl);

      // Mock authenticated user
      app.use((req, res, next) => {
        req.user = { id: "user-123" };
        next();
      });

      const response = await request(app).get("/auth/google").expect(302);

      expect(response.headers.location).toBe(authUrl);
      expect(mockGoogleProvider.getAuthorizationUrl).toHaveBeenCalledWith("user-123");
    });

    it("should handle Google OAuth initiation error", async () => {
      mockGoogleProvider.getAuthorizationUrl.mockRejectedValue(new Error("OAuth error"));

      const response = await request(app).get("/auth/google").expect(302);

      expect(response.headers.location).toBe("/login?error=oauth_init_failed");
    });
  });

  describe("GET /auth/google/callback", () => {
    it("should handle successful Google OAuth callback", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };
      const mockSession = {
        token: "jwt-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockGoogleProvider.handleCallback.mockResolvedValue({
        success: true,
        user: mockUser,
        session: mockSession,
      });

      const response = await request(app)
        .get("/auth/google/callback")
        .query({ code: "auth-code", state: "valid-state" })
        .expect(302);

      expect(response.headers.location).toBe("http://localhost:3000/dashboard?welcome=true");
      expect(mockGoogleProvider.handleCallback).toHaveBeenCalledWith("auth-code", "valid-state");

      // Check cookies are set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toEqual(
        expect.arrayContaining([
          expect.stringContaining("sessionToken=jwt-token"),
          expect.stringContaining("refreshToken=refresh-token"),
        ]),
      );
    });

    it("should handle OAuth error parameter", async () => {
      const response = await request(app)
        .get("/auth/google/callback")
        .query({ error: "access_denied" })
        .expect(302);

      expect(response.headers.location).toBe("/login?error=oauth_cancelled");
      expect(mockGoogleProvider.handleCallback).not.toHaveBeenCalled();
    });

    it("should handle missing code parameter", async () => {
      const response = await request(app)
        .get("/auth/google/callback")
        .query({ state: "valid-state" })
        .expect(302);

      expect(response.headers.location).toBe("/login?error=oauth_invalid_response");
      expect(mockGoogleProvider.handleCallback).not.toHaveBeenCalled();
    });

    it("should handle missing state parameter", async () => {
      const response = await request(app)
        .get("/auth/google/callback")
        .query({ code: "auth-code" })
        .expect(302);

      expect(response.headers.location).toBe("/login?error=oauth_invalid_response");
      expect(mockGoogleProvider.handleCallback).not.toHaveBeenCalled();
    });

    it("should handle OAuth callback failure", async () => {
      mockGoogleProvider.handleCallback.mockResolvedValue({
        success: false,
        error: "Invalid authorization code",
      });

      const response = await request(app)
        .get("/auth/google/callback")
        .query({ code: "invalid-code", state: "valid-state" })
        .expect(302);

      expect(response.headers.location).toBe("/login?error=Invalid%20authorization%20code");
    });

    it("should handle OAuth callback exception", async () => {
      mockGoogleProvider.handleCallback.mockRejectedValue(new Error("Callback error"));

      const response = await request(app)
        .get("/auth/google/callback")
        .query({ code: "auth-code", state: "valid-state" })
        .expect(302);

      expect(response.headers.location).toBe("/login?error=oauth_callback_failed");
    });
  });

  describe("GET /auth/discord", () => {
    it("should redirect to Discord OAuth URL", async () => {
      const authUrl =
        "https://discord.com/api/oauth2/authorize?client_id=test&scope=identify+email&state=abc123";
      mockDiscordProvider.getAuthorizationUrl.mockResolvedValue(authUrl);

      const response = await request(app).get("/auth/discord").expect(302);

      expect(response.headers.location).toBe(authUrl);
      expect(mockDiscordProvider.getAuthorizationUrl).toHaveBeenCalledWith(undefined);
    });

    it("should handle Discord OAuth initiation error", async () => {
      mockDiscordProvider.getAuthorizationUrl.mockRejectedValue(new Error("OAuth error"));

      const response = await request(app).get("/auth/discord").expect(302);

      expect(response.headers.location).toBe("/login?error=oauth_init_failed");
    });
  });

  describe("GET /auth/discord/callback", () => {
    it("should handle successful Discord OAuth callback", async () => {
      const mockUser = { id: "user-456", email: "discord@example.com" };
      const mockSession = {
        token: "jwt-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockDiscordProvider.handleCallback.mockResolvedValue({
        success: true,
        user: mockUser,
        session: mockSession,
      });

      const response = await request(app)
        .get("/auth/discord/callback")
        .query({ code: "auth-code", state: "valid-state" })
        .expect(302);

      expect(response.headers.location).toBe("http://localhost:3000/dashboard?welcome=true");
      expect(mockDiscordProvider.handleCallback).toHaveBeenCalledWith("auth-code", "valid-state");
    });

    it("should handle Discord callback failure", async () => {
      mockDiscordProvider.handleCallback.mockResolvedValue({
        success: false,
        error: "Invalid Discord token",
      });

      const response = await request(app)
        .get("/auth/discord/callback")
        .query({ code: "invalid-code", state: "valid-state" })
        .expect(302);

      expect(response.headers.location).toBe("/login?error=Invalid%20Discord%20token");
    });
  });

  describe("POST /auth/logout", () => {
    it("should handle logout successfully", async () => {
      // Mock req.logout method
      app.use((req, res, next) => {
        req.logout = jest.fn().mockImplementation((done) => {
          if (typeof done === "function") {
            done();
          }
        });
        next();
      });

      const response = await request(app).post("/auth/logout").expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Logged out successfully",
      });
    });

    it("should handle logout error", async () => {
      // Mock req.logout method with error
      app.use((req, res, next) => {
        req.logout = jest.fn().mockImplementation((done) => {
          if (typeof done === "function") {
            done(new Error("Logout failed"));
          }
        });
        next();
      });

      const response = await request(app).post("/auth/logout").expect(500);

      expect(response.body).toEqual({
        error: "Logout failed",
      });
    });
  });

  describe("GET /auth/me", () => {
    it("should return user info when authenticated", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        username: "testuser",
        displayName: "Test User",
        avatar: "avatar.jpg",
        provider: "google",
      };

      app.use((req, res, next) => {
        req.user = mockUser;
        next();
      });

      const response = await request(app).get("/auth/me").expect(200);

      expect(response.body).toEqual(mockUser);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/auth/me").expect(401);

      expect(response.body).toEqual({
        error: "Not authenticated",
      });
    });
  });

  describe("GET /auth/link/:provider", () => {
    it("should redirect to provider for account linking when authenticated", async () => {
      app.use((req, res, next) => {
        req.user = { id: "user-123" };
        next();
      });

      const response = await request(app).get("/auth/link/google").expect(302);

      expect(response.headers.location).toBe("/auth/google");
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/auth/link/google").expect(401);

      expect(response.body).toEqual({
        error: "Must be logged in to link accounts",
      });
    });

    it("should return 400 for invalid provider", async () => {
      app.use((req, res, next) => {
        req.user = { id: "user-123" };
        next();
      });

      const response = await request(app).get("/auth/link/invalid").expect(400);

      expect(response.body).toEqual({
        error: "Invalid OAuth provider",
      });
    });
  });
});
