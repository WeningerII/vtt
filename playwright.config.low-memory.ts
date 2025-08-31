import { defineConfig, devices } from "@playwright/test";
import { E2E_CONFIG } from "./e2e/test-config";

/**
 * Playwright Configuration for Low-Memory Environments
 * Use this config when running on resource-constrained systems
 */
export default defineConfig({
  testDir: "./e2e",
  
  // Single worker only
  fullyParallel: false,
  workers: 1,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry less aggressively to save resources */
  retries: process.env.CI ? 1 : 0,
  
  /* Reporter to use */
  reporter: [["html"], ["line"]],
  
  /* Shared settings */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: E2E_CONFIG.urls.client,

    /* Minimal tracing to save memory */
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",

    /* Shorter timeouts */
    actionTimeout: E2E_CONFIG.timeouts.action,
    navigationTimeout: E2E_CONFIG.timeouts.navigation,
  },

  /* Reduced test timeout */
  timeout: 20000,
  expect: {
    timeout: E2E_CONFIG.timeouts.expect,
  },

  /* Single browser only - Chromium for best compatibility */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: true,
        viewport: { width: 1280, height: 720 },
        // Reduce memory usage
        launchOptions: {
          args: [
            '--memory-pressure-off',
            '--max_old_space_size=512',
          ],
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: "pnpm dev:server",
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 60000, // Reduced timeout
      env: {
        NODE_ENV: "test",
        DATABASE_URL: "file:./test.db",
        JWT_SECRET: "test-jwt-secret-key-for-e2e-testing",
        AI_ENABLE_AUTO_PROVIDERS: "false",
        AI_ENABLE_LOCAL_PROVIDER: "false",
        E2E_SKIP_DB: process.env.E2E_SKIP_DB || "1",
        RATE_LIMIT_ENABLED: "false", // Disable to reduce overhead
        SECURITY_HEADERS_ENABLED: "false",
        TELEMETRY_DISABLED: "true",
        CORS_ORIGIN: "http://localhost:3000",
        // Optimize Node.js memory usage
        NODE_OPTIONS: "--max-old-space-size=1024",
      },
    },
    ...(process.env.E2E_SKIP_CLIENT
      ? []
      : [
          {
            command: "pnpm --filter @vtt/client dev -- --port 3000 --strictPort",
            port: 3000,
            reuseExistingServer: !process.env.CI,
            timeout: 60000,
            env: {
              NODE_ENV: "test",
              NEXT_PUBLIC_API_URL: "http://localhost:8080",
              NEXT_PUBLIC_WS_URL: "ws://localhost:8080/ws",
              NEXT_PUBLIC_FEATURE_REAL_TIME: "true",
              NEXT_PUBLIC_FEATURE_AI: "false", // Disable AI features to save memory
              NEXT_PUBLIC_TELEMETRY_DISABLED: "true",
            },
          },
        ]),
  ],
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  globalTeardown: require.resolve("./e2e/global-teardown.ts"),
});
