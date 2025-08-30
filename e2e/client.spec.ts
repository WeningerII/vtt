import { test, expect } from "@playwright/test";

test.describe("Client Application", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/VTT/);
  });

  test("renders virtual tabletop interface", async ({ page }) => {
    await page.goto("/");

    // Wait for React to hydrate
    await page.waitForLoadState("networkidle");

    // Check for basic UI elements
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
  });

  test("handles responsive design", async ({ page }) => {
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
  });

  test("WebSocket connection establishes", async ({ page }) => {
    let wsConnected = false;

    page.on("websocket", (ws) => {
      ws.on("framereceived", () => {
        wsConnected = true;
      });
      ws.on("framesent", () => {
        wsConnected = true;
      });
    });

    await page.goto("/");
    await page.waitForTimeout(2000); // Give WebSocket time to connect

    expect(wsConnected).toBe(true);
  });
});

test.describe("Performance", () => {
  test("page loads within performance budget", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test("no console errors on initial load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);
  });
});
