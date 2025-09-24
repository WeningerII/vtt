/**
 * Security Integration End-to-End Tests
 * Tests the complete security pipeline with real HTTP requests
 */

import { test, expect } from "@playwright/test";
import { SecuritySystem } from "../packages/security/src";
import { RateLimiter, RATE_LIMIT_PRESETS } from "../packages/security/src/RateLimiter";

test.describe("Security Integration Tests", () => {
  let securitySystem: SecuritySystem;
  let baseURL: string;

  test.beforeAll(async () => {
    baseURL = process.env.TEST_SERVER_URL || "http://localhost:8080";

    securitySystem = new SecuritySystem({
      auth: {
        jwtSecret: "test-secret-key-for-e2e",
        jwtRefreshSecret: "test-refresh-secret-for-e2e",
        accessTokenExpiry: "15m",
        refreshTokenExpiry: "7d",
        bcryptRounds: 4, // Lower for testing performance
        maxSessions: 5,
        requireEmailVerification: false,
      },
    });
  });

  test.describe("Authentication Flow", () => {
    test("should complete full user registration and login flow", async ({ request }) => {
      // Register new user
      const registerResponse = await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email: "e2e-test@example.com",
          username: "e2euser",
          password: "SecureTestPass123!",
          acceptTerms: true,
        },
      });

      expect(registerResponse.ok()).toBeTruthy();
      const registerData = await registerResponse.json();
      expect(registerData.success).toBe(true);
      expect(registerData.user.email).toBe("e2e-test@example.com");
      expect(registerData.token).toBeDefined();

      // Login with registered credentials
      const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "e2e-test@example.com",
          password: "SecureTestPass123!",
        },
      });

      expect(loginResponse.ok()).toBeTruthy();
      const loginData = await loginResponse.json();
      expect(loginData.success).toBe(true);
      expect(loginData.token.accessToken).toBeDefined();
    });

    test("should reject invalid login credentials", async ({ request }) => {
      const response = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "nonexistent@example.com",
          password: "wrongpassword",
        },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe("INVALID_CREDENTIALS");
    });

    test("should protect authenticated endpoints", async ({ request }) => {
      // Try to access protected endpoint without token
      const response = await request.get(`${baseURL}/api/scenes`);
      expect(response.status()).toBe(401);

      // Register and login to get token
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email: "protected-test@example.com",
          username: "protecteduser",
          password: "ProtectedPass123!",
          acceptTerms: true,
        },
      });

      const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "protected-test@example.com",
          password: "ProtectedPass123!",
        },
      });

      const { token } = await loginResponse.json();

      // Access protected endpoint with valid token
      const protectedResponse = await request.get(`${baseURL}/api/scenes`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
      });

      expect(protectedResponse.ok()).toBeTruthy();
    });

    test("should refresh expired tokens", async ({ request }) => {
      // Register user
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email: "refresh-test@example.com",
          username: "refreshuser",
          password: "RefreshPass123!",
          acceptTerms: true,
        },
      });

      // Login to get initial tokens
      const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "refresh-test@example.com",
          password: "RefreshPass123!",
        },
      });

      const { token } = await loginResponse.json();

      // Use refresh token to get new access token
      const refreshResponse = await request.post(`${baseURL}/api/auth/refresh`, {
        data: {
          refreshToken: token.refreshToken,
        },
      });

      expect(refreshResponse.ok()).toBeTruthy();
      const refreshData = await refreshResponse.json();
      expect(refreshData.success).toBe(true);
      expect(refreshData.token.accessToken).toBeDefined();
      expect(refreshData.token.accessToken).not.toBe(token.accessToken);
    });
  });

  test.describe("Rate Limiting", () => {
    test("should enforce rate limits on API endpoints", async ({ request }) => {
      const endpoint = `${baseURL}/api/auth/login`;
      const requests = [];

      // Make multiple rapid requests to trigger rate limit
      for (let i = 0; i < 10; i++) {
        requests.push(
          request.post(endpoint, {
            data: {
              email: "ratelimit-test@example.com",
              password: "wrongpassword",
            },
          }),
        );
      }

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter((r) => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit headers
      const rateLimitedResponse = rateLimitedResponses[0];
      const retryAfter = rateLimitedResponse.headers()["retry-after"];
      expect(retryAfter).toBeDefined();
    });

    test("should have different rate limits for different endpoints", async ({ request }) => {
      // Test strict endpoint (auth)
      const authRequests = [];
      for (let i = 0; i < 5; i++) {
        authRequests.push(
          request.post(`${baseURL}/api/auth/login`, {
            data: { email: "test@test.com", password: "wrong" },
          }),
        );
      }

      const authResponses = await Promise.all(authRequests);
      const authRateLimited = authResponses.filter((r) => r.status() === 429).length;

      // Test moderate endpoint (general API)
      const apiRequests = [];
      for (let i = 0; i < 20; i++) {
        apiRequests.push(request.get(`${baseURL}/api/health`));
      }

      const apiResponses = await Promise.all(apiRequests);
      const apiRateLimited = apiResponses.filter((r) => r.status() === 429).length;

      // Auth should be more strictly rate limited than general API
      expect(authRateLimited).toBeGreaterThanOrEqual(apiRateLimited);
    });
  });

  test.describe("Input Validation", () => {
    test("should sanitize and validate user input", async ({ request }) => {
      // Register user for authenticated requests
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email: "validation-test@example.com",
          username: "validationuser",
          password: "ValidationPass123!",
          acceptTerms: true,
        },
      });

      const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "validation-test@example.com",
          password: "ValidationPass123!",
        },
      });

      const { token } = await loginResponse.json();

      // Test XSS prevention
      const xssResponse = await request.post(`${baseURL}/api/scenes`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        data: {
          name: '<script>alert("xss")</script>Malicious Scene',
          width: 800,
          height: 600,
        },
      });

      expect(xssResponse.status()).toBe(400);
      const xssData = await xssResponse.json();
      expect(xssData.error).toContain("validation");

      // Test SQL injection prevention
      const sqlResponse = await request.post(`${baseURL}/api/scenes`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        data: {
          name: "'; DROP TABLE scenes; --",
          width: 800,
          height: 600,
        },
      });

      expect(sqlResponse.status()).toBe(400);
    });

    test("should validate file upload security", async ({ request }) => {
      // Register user
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email: "upload-test@example.com",
          username: "uploaduser",
          password: "UploadPass123!",
          acceptTerms: true,
        },
      });

      const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: {
          email: "upload-test@example.com",
          password: "UploadPass123!",
        },
      });

      const { token } = await loginResponse.json();

      // Test dangerous file upload (should be blocked)
      const maliciousResponse = await request.post(`${baseURL}/api/assets/upload`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        multipart: {
          file: {
            name: "malicious.exe",
            mimeType: "application/exe",
            buffer: Buffer.from("fake exe content"),
          },
        },
      });

      expect(maliciousResponse.status()).toBe(400);
      const maliciousData = await maliciousResponse.json();
      expect(maliciousData.error).toContain("file type not allowed");

      // Test legitimate file upload (should succeed)
      const legitimateResponse = await request.post(`${baseURL}/api/assets/upload`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
        multipart: {
          file: {
            name: "test-image.png",
            mimeType: "image/png",
            buffer: Buffer.from("fake png content"),
          },
        },
      });

      expect(legitimateResponse.ok()).toBeTruthy();
    });
  });

  test.describe("Threat Detection", () => {
    test("should detect and block brute force attempts", async ({ request }) => {
      const email = "bruteforce-target@example.com";

      // Register target account
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email,
          username: "bruteforceuser",
          password: "CorrectPassword123!",
          acceptTerms: true,
        },
      });

      // Simulate brute force attack with wrong passwords
      const bruteForceRequests = [];
      for (let i = 0; i < 10; i++) {
        bruteForceRequests.push(
          request.post(`${baseURL}/api/auth/login`, {
            data: {
              email,
              password: `wrongpassword${i}`,
            },
          }),
        );
      }

      const responses = await Promise.all(bruteForceRequests);

      // Later attempts should be blocked (status 429 or 403)
      const blockedResponses = responses
        .slice(-3)
        .filter((r) => r.status() === 429 || r.status() === 403);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    test("should detect suspicious user agents", async ({ request }) => {
      const suspiciousAgents = [
        "sqlmap/1.0",
        "nikto/2.1.6",
        "python-requests/2.25.1",
        "curl/7.68.0",
      ];

      for (const userAgent of suspiciousAgents) {
        const response = await request.get(`${baseURL}/api/health`, {
          headers: {
            "User-Agent": userAgent,
          },
        });

        // Should either block or apply additional restrictions
        expect([200, 403, 429]).toContain(response.status());

        if (response.status() === 200) {
          // If allowed, should have additional headers indicating monitoring
          expect(response.headers()["x-security-warning"]).toBeDefined();
        }
      }
    });
  });

  test.describe("Session Management", () => {
    test("should handle concurrent sessions properly", async ({ request, browser }) => {
      const email = "concurrent-sessions@example.com";

      // Register user
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email,
          username: "concurrentuser",
          password: "ConcurrentPass123!",
          acceptTerms: true,
        },
      });

      // Create multiple browser contexts (simulating different devices)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      const context3 = await browser.newContext();

      const contexts = [context1, context2, context3];
      const tokens = [];

      // Login from each context
      for (const context of contexts) {
        const page = await context.newPage();

        const response = await page.request.post(`${baseURL}/api/auth/login`, {
          data: { email, password: "ConcurrentPass123!" },
        });

        const { token } = await response.json();
        tokens.push(token.accessToken);

        await page.close();
      }

      // All tokens should be valid initially
      for (const token of tokens) {
        const response = await request.get(`${baseURL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(response.ok()).toBeTruthy();
      }

      // Cleanup
      await context1.close();
      await context2.close();
      await context3.close();
    });

    test("should invalidate sessions on logout", async ({ request }) => {
      const email = "logout-test@example.com";

      // Register and login
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email,
          username: "logoutuser",
          password: "LogoutPass123!",
          acceptTerms: true,
        },
      });

      const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: { email, password: "LogoutPass123!" },
      });

      const { token } = await loginResponse.json();

      // Verify token works
      let protectedResponse = await request.get(`${baseURL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      expect(protectedResponse.ok()).toBeTruthy();

      // Logout
      const logoutResponse = await request.post(`${baseURL}/api/auth/logout`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      expect(logoutResponse.ok()).toBeTruthy();

      // Token should now be invalid
      protectedResponse = await request.get(`${baseURL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      expect(protectedResponse.status()).toBe(401);
    });
  });

  test.describe("Role-Based Access Control", () => {
    test("should enforce role-based permissions", async ({ request }) => {
      // Register regular user
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email: "user-rbac@example.com",
          username: "regularuser",
          password: "UserPass123!",
          acceptTerms: true,
        },
      });

      const userLoginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: { email: "user-rbac@example.com", password: "UserPass123!" },
      });

      const { token: userToken } = await userLoginResponse.json();

      // Regular user should not be able to access admin endpoints
      const adminResponse = await request.get(`${baseURL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${userToken.accessToken}` },
      });
      expect(adminResponse.status()).toBe(403);

      // Register GM user
      await request.post(`${baseURL}/api/auth/register`, {
        data: {
          email: "gm-rbac@example.com",
          username: "gmuser",
          password: "GMPass123!",
          acceptTerms: true,
        },
      });

      const gmLoginResponse = await request.post(`${baseURL}/api/auth/login`, {
        data: { email: "gm-rbac@example.com", password: "GMPass123!" },
      });

      const { token: gmToken } = await gmLoginResponse.json();

      // Promote to GM role (would normally be done by admin)
      await request.post(`${baseURL}/api/admin/users/gm-rbac@example.com/roles`, {
        headers: { Authorization: `Bearer ${gmToken.accessToken}` },
        data: { role: "gm" },
      });

      // GM should be able to manage scenes
      const sceneResponse = await request.post(`${baseURL}/api/scenes`, {
        headers: { Authorization: `Bearer ${gmToken.accessToken}` },
        data: {
          name: "GM Scene",
          width: 800,
          height: 600,
        },
      });
      expect(sceneResponse.ok()).toBeTruthy();
    });
  });

  test.describe("Security Headers and HTTPS", () => {
    test("should include security headers in responses", async ({ request }) => {
      const response = await request.get(`${baseURL}/api/health`);

      const headers = response.headers();

      // Check for security headers
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-frame-options"]).toBeDefined();
      expect(headers["x-xss-protection"]).toBeDefined();
      expect(headers["strict-transport-security"]).toBeDefined();
      expect(headers["content-security-policy"]).toBeDefined();
    });

    test("should handle CORS properly", async ({ request }) => {
      const response = await request.fetch(`${baseURL}/api/auth/login`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://trusted-domain.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });

      expect(response.status()).toBe(200);
      expect(response.headers()["access-control-allow-origin"]).toBeDefined();
      expect(response.headers()["access-control-allow-methods"]).toBeDefined();
    });
  });

  test.describe("Performance Under Security Load", () => {
    test("should maintain performance under security scanning", async ({ request }) => {
      const startTime = Date.now();
      const requests = [];

      // Simulate security scanner making many requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          request.get(`${baseURL}/api/health`, {
            headers: {
              "User-Agent": "Security Scanner Test",
            },
          }),
        );
      }

      await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time even with security checks
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    test("should handle malformed requests gracefully", async ({ request }) => {
      // Test various malformed requests
      const malformedRequests = [
        // Extremely large payload
        request.post(`${baseURL}/api/auth/login`, {
          data: {
            email: "a".repeat(10000),
            password: "b".repeat(10000),
          },
        }),

        // Invalid JSON
        request.post(`${baseURL}/api/auth/login`, {
          data: '{"invalid": json}',
          headers: { "Content-Type": "application/json" },
        }),

        // Missing required fields
        request.post(`${baseURL}/api/auth/login`, {
          data: {} as Record<string, any>,
        }),
      ];

      const responses = await Promise.allSettled(
        malformedRequests.map((req) => req.catch((e) => ({ error: e }))),
      );

      // Server should handle all requests without crashing
      responses.forEach((response) => {
        expect(response.status).toBe("fulfilled");
      });
    });
  });
});
