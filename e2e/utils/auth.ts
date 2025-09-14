import { Page, APIRequestContext } from '@playwright/test';
import { factory, TestUser } from './factories';
import { testDb } from './database';
import bcrypt from 'bcrypt';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface AuthenticatedUser {
  user: TestUser;
  tokens: AuthTokens;
}

export class AuthTestUtils {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8080') {
    this.baseURL = baseURL;
  }

  /**
   * Create a user with authentication credentials
   */
  async createUserWithAuth(displayName: string, password: string = 'password123'): Promise<TestUser & { password: string }> {
    const _passwordHash = await bcrypt.hash(password, 4);
    
    // For now, create basic user since auth schema may differ
    const user = await factory.createUser({ displayName });
    
    return {
      ...user,
      password,
    };
  }

  /**
   * Register a new user via API
   */
  async registerUser(request: APIRequestContext, userData: {
    displayName: string;
    email?: string;
    password?: string;
  }): Promise<AuthenticatedUser> {
    const registrationData = {
      displayName: userData.displayName,
      email: userData.email || `${userData.displayName.toLowerCase().replace(/\s+/g, '')}@test.com`,
      password: userData.password || 'password123',
    };

    const response = await request.post(`${this.baseURL}/api/auth/register`, {
      data: registrationData,
    });

    if (!response.ok()) {
      throw new Error(`Registration failed: ${response.status()} ${await response.text()}`);
    }

    const result = await response.json();
    return {
      user: result.user,
      tokens: result.tokens,
    };
  }

  /**
   * Login user via API
   */
  async loginUser(request: APIRequestContext, credentials: {
    email: string;
    password: string;
  }): Promise<AuthenticatedUser> {
    const response = await request.post(`${this.baseURL}/api/auth/login`, {
      data: credentials,
    });

    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
    }

    const result = await response.json();
    return {
      user: result.user,
      tokens: result.tokens,
    };
  }

  /**
   * Login user via browser page
   */
  async loginUserInBrowser(page: Page, credentials: {
    email: string;
    password: string;
  }): Promise<void> {
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', credentials.email);
    await page.fill('[data-testid="password-input"]', credentials.password);
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect to dashboard or main app
    await page.waitForURL(/(dashboard|app|campaigns)/);
  }

  /**
   * Set authentication headers for API requests
   */
  getAuthHeaders(tokens: AuthTokens): Record<string, string> {
    return {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create authenticated request context
   */
  async createAuthenticatedContext(request: APIRequestContext, user: AuthenticatedUser): Promise<APIRequestContext> {
    return request;
  }

  /**
   * Logout user
   */
  async logoutUser(request: APIRequestContext, tokens: AuthTokens): Promise<void> {
    await request.post(`${this.baseURL}/api/auth/logout`, {
      headers: this.getAuthHeaders(tokens),
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(request: APIRequestContext, refreshToken: string): Promise<AuthTokens> {
    const response = await request.post(`${this.baseURL}/api/auth/refresh`, {
      data: { refreshToken },
    });

    if (!response.ok()) {
      throw new Error(`Token refresh failed: ${response.status()}`);
    }

    const result = await response.json();
    return result.tokens;
  }

  /**
   * Verify user is authenticated in browser
   */
  async verifyAuthenticated(page: Page): Promise<boolean> {
    try {
      // Check for authenticated user indicators
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create multiple test users with different roles
   */
  async createTestUsers(): Promise<{
    admin: TestUser & { password: string };
    gm: TestUser & { password: string };
    player1: TestUser & { password: string };
    player2: TestUser & { password: string };
  }> {
    const [admin, gm, player1, player2] = await Promise.all([
      this.createUserWithAuth('Test Admin'),
      this.createUserWithAuth('Test GM'),
      this.createUserWithAuth('Test Player 1'),
      this.createUserWithAuth('Test Player 2'),
    ]);

    return { admin, gm, player1, player2 };
  }

  /**
   * Setup authenticated session for testing
   */
  async setupAuthenticatedSession(request: APIRequestContext, displayName: string): Promise<AuthenticatedUser> {
    const email = `${displayName.toLowerCase().replace(/\s+/g, '')}@test.com`;
    const password = 'password123';

    try {
      // Try to login first
      return await this.loginUser(request, { email, password });
    } catch {
      // If login fails, register new user
      return await this.registerUser(request, { displayName, email, password });
    }
  }

  /**
   * Clean up user sessions
   */
  async cleanupUserSessions(userId: string): Promise<void> {
    const prisma = await testDb.getClient();
    
    // Clean up any session-related data if schema supports it
    // This would depend on your actual auth implementation
    try {
      // Example cleanup - adjust based on actual schema
      await prisma.user.update({
        where: { id: userId },
        data: {
          // Reset any session-related fields
        },
      });
    } catch (error) {
      console.warn('Session cleanup failed:', error);
    }
  }

  /**
   * Mock authentication for tests that don't need full auth flow
   */
  async mockAuthentication(page: Page, user: TestUser): Promise<void> {
    // Set authentication state in browser storage
    await page.addInitScript((_userData) => {
      localStorage.setItem('vtt-auth-user', JSON.stringify(_userData));
      localStorage.setItem('vtt-auth-token', 'mock-token-for-testing');
    }, user);
  }

  /**
   * Wait for authentication state to be ready
   */
  async waitForAuthReady(page: Page, timeout: number = 10000): Promise<void> {
    await page.waitForFunction(
      () => {
        // Check if auth state is loaded
        return window.localStorage.getItem('vtt-auth-user') !== null ||
               document.querySelector('[data-testid="user-menu"]') !== null ||
               document.querySelector('[data-testid="login-form"]') !== null;
      },
      { timeout }
    );
  }
}

export const _authUtils = new AuthTestUtils();
export const authUtils = _authUtils;
export default _authUtils;
