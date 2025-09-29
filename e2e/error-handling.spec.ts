import { test, expect } from "@playwright/test";
import { _factory } from "./utils/factories";
import { _authUtils } from "./utils/auth";
import { testDb as _testDb } from "./utils/database";

test.describe("Error Handling and Resilience Tests", () => {
  const isEnabled = process.env.E2E_UI_ADVANCED === "1" || process.env.E2E_UI_FALLBACKS === "1";
  test.skip(
    !isEnabled,
    "Skipping UI resilience tests unless E2E_UI_ADVANCED=1 (or E2E_UI_FALLBACKS=1) is set.",
  );

  test.beforeEach(async () => {
    await _testDb.reset();
  });

  test("Network failure recovery", async ({ page, context }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    await _authUtils.mockAuthentication(page, gm);
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await _authUtils.waitForAuthReady(page);

    // Verify initial connection
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText("Connected");

    // Simulate network failure
    await context.setOffline(true);
    await page.waitForTimeout(2000);

    // Verify offline indicator appears
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText("Offline");

    // Try to perform actions while offline
    const token = page.locator('[data-testid="token"]').first();
    await token.hover();
    await page.mouse.down();
    await page.mouse.move(300, 300);
    await page.mouse.up();

    // Send chat message while offline
    await page.fill('[data-testid="chat-input"]', "Offline message");
    await page.press('[data-testid="chat-input"]', "Enter");

    // Verify queued actions indicator
    await expect(page.locator('[data-testid="queued-actions"]')).toBeVisible();

    // Restore network
    await context.setOffline(false);
    await page.waitForTimeout(5000);

    // Verify reconnection
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText("Connected");
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();

    // Verify queued actions were applied
    await expect(token).toHaveAttribute("data-x", "300");
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText(
      "Offline message",
    );
    await expect(page.locator('[data-testid="queued-actions"]')).not.toBeVisible();

    // Should attempt retry
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
  });

  test("Server error handling", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    await _authUtils.mockAuthentication(page, gm);

    // Mock server errors
    await page.route("**/api/**", (route) => {
      if (route.request().url().includes("/scenes/")) {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal Server Error" }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);

    // Verify error handling
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      "Failed to load scene",
    );

    // Verify retry mechanism
    await page.click('[data-testid="retry-button"]');
    await page.waitForTimeout(2000);

    // Should attempt retry
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
  });

  test("Authentication expiration handling", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    await _authUtils.mockAuthentication(page, gm);
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await _authUtils.waitForAuthReady(page);

    // Mock authentication expiration
    await page.route("**/api/**", (route) => {
      if (route.request().headers()["authorization"]) {
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Token expired" }),
        });
      } else {
        route.continue();
      }
    });

    // Try to perform an action that requires authentication
    await page.click('[data-testid="save-scene"]');

    // Verify auth expiration handling
    await expect(page.locator('[data-testid="auth-expired-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="reauth-prompt"]')).toContainText(
      "Please log in again",
    );

    // Test automatic token refresh
    await page.click('[data-testid="refresh-token"]');
    await page.waitForTimeout(2000);

    // Should redirect to login or refresh token
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test("Database connection failure", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    await _authUtils.mockAuthentication(page, gm);

    // Mock database errors
    await page.route("**/api/**", (route) => {
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Database unavailable" }),
      });
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);

    // Verify database error handling
    await expect(page.locator('[data-testid="service-unavailable"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      "Service temporarily unavailable",
    );

    // Verify graceful degradation
    await expect(page.locator('[data-testid="offline-mode-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="limited-functionality"]')).toContainText(
      "Limited functionality available",
    );
  });

  test("WebSocket connection failure and recovery", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    let wsConnectionCount = 0;
    let wsDisconnectionCount = 0;

    page.on("websocket", (ws) => {
      wsConnectionCount++;
      console.log(`WebSocket connection #${wsConnectionCount}`);

      ws.on("close", () => {
        wsDisconnectionCount++;
        console.log(`WebSocket disconnection #${wsDisconnectionCount}`);
      });
    });

    await _authUtils.mockAuthentication(page, gm);
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await _authUtils.waitForAuthReady(page);

    // Wait for initial WebSocket connection
    await page.waitForTimeout(3000);
    expect(wsConnectionCount).toBeGreaterThan(0);

    // Simulate WebSocket server unavailable
    await page.route("**/ws", (route) => {
      route.abort();
    });

    // Force WebSocket reconnection attempt
    await page.evaluate(() => {
      // Trigger reconnection logic
      window.dispatchEvent(new Event("online"));
    });

    await page.waitForTimeout(3000);

    // Verify reconnection attempts
    await expect(page.locator('[data-testid="websocket-reconnecting"]')).toBeVisible();

    // Clear route to allow reconnection
    await page.unroute("**/ws");
    await page.waitForTimeout(5000);

    // Verify successful reconnection
    expect(wsConnectionCount).toBeGreaterThan(1);
    await expect(page.locator('[data-testid="websocket-connected"]')).toBeVisible();
  });

  test("Invalid data handling", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    await _authUtils.mockAuthentication(page, gm);

    // Mock invalid API responses
    await page.route("**/api/scenes/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "invalid-id",
          name: null, // Invalid data
          tokens: "not-an-array", // Type mismatch
          invalidField: "should-be-ignored",
        }),
      });
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);

    // Verify graceful handling of invalid data
    await expect(page.locator('[data-testid="data-validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="fallback-scene-name"]')).toContainText(
      "Untitled Scene",
    );

    // Verify application doesn't crash
    await expect(page.locator('[data-testid="scene-canvas"]')).toBeVisible();
  });

  test("Concurrent modification conflicts", async ({ browser }) => {
    const gameSession = await _factory.createCompleteGameSession();
    const { gm, player1 } = gameSession.users;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await _authUtils.mockAuthentication(gmPage, gm);
      await _authUtils.mockAuthentication(playerPage, player1);

      const sceneUrl = `/scenes/${gameSession.scene.id}`;
      await Promise.all([gmPage.goto(sceneUrl), playerPage.goto(sceneUrl)]);

      await Promise.all([
        _authUtils.waitForAuthReady(gmPage),
        _authUtils.waitForAuthReady(playerPage),
      ]);

      await gmPage.waitForTimeout(2000);

      // Both users try to edit the same token simultaneously
      const gmToken = gmPage.locator('[data-testid="token"]').first();
      const playerToken = playerPage.locator('[data-testid="token"]').first();

      // GM starts editing token properties
      await gmToken.click({ button: "right" });
      await gmPage.click('[data-testid="edit-token"]');
      await gmPage.fill('[data-testid="token-name"]', "GM Edit");

      // Player tries to move the same token
      await playerToken.hover();
      await playerPage.mouse.down();
      await playerPage.mouse.move(400, 400);
      await playerPage.mouse.up();

      // GM saves changes
      await gmPage.click('[data-testid="save-token"]');

      await gmPage.waitForTimeout(2000);

      // Verify conflict resolution
      await expect(gmPage.locator('[data-testid="conflict-resolution"]')).toBeVisible();
      await expect(playerPage.locator('[data-testid="conflict-notification"]')).toBeVisible();

      // Verify one change wins or merge is attempted
      const finalTokenName = await gmToken.getAttribute("data-name");
      const finalTokenX = await gmToken.getAttribute("data-x");

      expect(finalTokenName).toBeTruthy();
      expect(finalTokenX).toBeTruthy();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test("Memory leak prevention", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    test.slow();
    // Allow slower navigations during repeated scene switches
    page.setDefaultNavigationTimeout(20000);
    await _authUtils.mockAuthentication(page, gm);
    // Load app shell first to avoid dev server cold-route timeouts
    await page.goto(`/`, { waitUntil: "commit" });
    await _authUtils.waitForAuthReady(page);
    // SPA navigate to the scene route
    await page.evaluate((path) => {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, `/scenes/${gameSession.scene.id}`);
    await page.waitForFunction((id) => location.pathname.includes(id), gameSession.scene.id, {
      timeout: 15000,
    });
    await page.waitForSelector('[data-testid="scene-canvas"]', { timeout: 15000 });

    // Get initial memory baseline
    const getMemoryUsage = () =>
      page.evaluate(() => {
        return {
          usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
          totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0,
        };
      });

    const initialMemory = await getMemoryUsage();

    // Perform operations that could cause memory leaks
    for (let i = 0; i < 8; i++) {
      // SPA navigation between pages to reduce flakiness
      await page.evaluate((path) => {
        window.history.pushState(null, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, `/campaigns/${gameSession.campaign.id}`);
      await page.waitForFunction((id) => location.pathname.includes(id), gameSession.campaign.id, {
        timeout: 15000,
      });
      await page.waitForTimeout(150);
      await page.evaluate((path) => {
        window.history.pushState(null, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, `/scenes/${gameSession.scene.id}`);
      await page.waitForFunction((id) => location.pathname.includes(id), gameSession.scene.id, {
        timeout: 15000,
      });
      // Ensure scene is rendered and ready
      await page.waitForSelector('[data-testid="scene-canvas"]', { timeout: 15000 });
      await page.waitForTimeout(150);

      // Create and destroy UI elements
      await page.waitForSelector('[data-testid="add-token-tool"]', { state: "visible" });
      await page.click('[data-testid="add-token-tool"]');
      await page.mouse.move(100 + i * 10, 100 + i * 10);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(100);

      // Delete token
      await page.click('[data-testid="token"]', { button: "right" });
      await page.click('[data-testid="delete-token"]');
      await page.waitForTimeout(100);
    }

    // Force garbage collection
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    await page.waitForTimeout(2000);

    const finalMemory = await getMemoryUsage();
    const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
    const memoryGrowthMB = memoryGrowth / (1024 * 1024);

    console.log(`Memory growth after operations: ${memoryGrowthMB.toFixed(2)}MB`);

    // Memory growth should be reasonable
    expect(memoryGrowthMB).toBeLessThan(20); // Less than 20MB growth
  });

  test("File upload error handling", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    await _authUtils.mockAuthentication(page, gm);
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await _authUtils.waitForAuthReady(page);

    // Test file too large
    await page.route("**/api/assets/upload", (route) => {
      route.fulfill({
        status: 413,
        contentType: "application/json",
        body: JSON.stringify({ error: "File too large" }),
      });
    });

    await page.click('[data-testid="upload-asset"]');

    // Create a mock file input
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.waitFor({ state: "visible", timeout: 15000 });
    await fileInput.setInputFiles(
      {
        name: "large-file.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(1024 * 1024 * 10), // 10MB
      },
      { timeout: 15000 },
    );

    // Verify error handling
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText("File too large");

    // Test invalid file type
    await page.unroute("**/api/assets/upload");
    await page.route("**/api/assets/upload", (route) => {
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid file type" }),
      });
    });

    await fileInput.waitFor({ state: "visible", timeout: 15000 });
    await fileInput.setInputFiles(
      {
        name: "invalid.exe",
        mimeType: "application/x-executable",
        buffer: Buffer.from("fake executable"),
      },
      { timeout: 15000 },
    );

    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText("Invalid file type");
  });

  test("Rate limiting handling", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    await _authUtils.mockAuthentication(page, gm);

    // Mock rate limiting
    let requestCount = 0;
    await page.route("**/api/**", (route) => {
      requestCount++;
      if (requestCount > 5) {
        route.fulfill({
          status: 429,
          contentType: "application/json",
          headers: {
            "Retry-After": "60",
          },
          body: JSON.stringify({ error: "Rate limit exceeded" }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`/scenes/${gameSession.scene.id}`);
    await _authUtils.waitForAuthReady(page);

    // Trigger multiple rapid requests
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="save-scene"]');
      await page.waitForTimeout(100);
    }

    // Verify rate limiting handling
    await expect(page.locator('[data-testid="rate-limit-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-after"]')).toContainText("60");

    // Verify automatic retry after delay
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="auto-retry-countdown"]')).toBeVisible();
  });

  test("Browser compatibility fallbacks", async ({ page }) => {
    const gameSession = await _factory.createMinimalGameSession();
    const { gm } = gameSession.users;

    // Mock unsupported browser features
    await page.addInitScript(() => {
      // Remove WebSocket support
      delete (window as any).WebSocket;

      // Remove modern Canvas features
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string) {
        if (type === "webgl" || type === "webgl2") {
          return null; // Simulate no WebGL support
        }
        return originalGetContext.call(this, type as any);
      } as any;

      // Remove modern audio features
      delete (window as any).AudioContext;
      delete (window as any).webkitAudioContext;
    });

    await _authUtils.mockAuthentication(page, gm);
    await page.goto(`/scenes/${gameSession.scene.id}`);
    await _authUtils.waitForAuthReady(page);

    // Verify fallback mechanisms
    await expect(page.locator('[data-testid="websocket-fallback"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-fallback"]')).toBeVisible();
    await expect(page.locator('[data-testid="audio-fallback"]')).toBeVisible();

    // Verify basic functionality still works
    await expect(page.locator('[data-testid="scene-canvas"]')).toBeVisible();

    // Test polling fallback for real-time updates
    await page.fill('[data-testid="chat-input"]', "Fallback test message");
    await page.press('[data-testid="chat-input"]', "Enter");

    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="chat-message"]').last()).toContainText(
      "Fallback test message",
    );
  });
});
