import { defineConfig, devices } from "@playwright/test";
import { E2E_CONFIG } from "./e2e/test-config";

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? E2E_CONFIG.retries.ci : E2E_CONFIG.retries.local,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? E2E_CONFIG.workers.ci : E2E_CONFIG.workers.local,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [
        ["html", { outputFolder: "playwright-report" }],
        ["json", { outputFile: "results.json" }],
        ["junit", { outputFile: "results.xml" }],
        ["./e2e/test-reporter.ts"],
      ]
    : [["html"], ["./e2e/test-reporter.ts"]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: E2E_CONFIG.urls.client,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",

    /* Test timeouts */
    actionTimeout: E2E_CONFIG.timeouts.action,
    navigationTimeout: E2E_CONFIG.timeouts.navigation,
  },

  /* Global test timeout */
  timeout: E2E_CONFIG.timeouts.test,
  expect: {
    timeout: E2E_CONFIG.timeouts.expect,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    },

    /* Mobile testing projects */
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 12"],
      },
    },
    {
      name: "Tablet",
      use: {
        ...devices["iPad Pro"],
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command:
        "pnpm dlx prisma generate --schema apps/server/prisma/schema.test.prisma && pnpm dev:server",
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: "test",
        DATABASE_URL: "file:./test.db",
        REDIS_URL: "redis://localhost:6379",
        MINIO_ENDPOINT: "localhost",
        MINIO_PORT: "9000",
        MINIO_ACCESS_KEY: "minioadmin",
        MINIO_SECRET_KEY: "minioadmin",
        JWT_SECRET: "test-jwt-secret-key-for-e2e-testing",
        OAUTH_GOOGLE_CLIENT_ID: "test-google-client-id",
        OAUTH_GOOGLE_CLIENT_SECRET: "test-google-client-secret",
        OAUTH_DISCORD_CLIENT_ID: "test-discord-client-id",
        OAUTH_DISCORD_CLIENT_SECRET: "test-discord-client-secret",
        AI_ENABLE_AUTO_PROVIDERS: "false",
        AI_ENABLE_LOCAL_PROVIDER: "false",
        E2E_SKIP_DB: process.env.E2E_SKIP_DB || "0",
        // Do NOT set real or dummy AI keys here so integration tests skip
        // OPENAI_API_KEY: '',
        // ANTHROPIC_API_KEY: '',
        RATE_LIMIT_ENABLED: "true",
        SECURITY_HEADERS_ENABLED: "true",
        TELEMETRY_DISABLED: "true",
        CORS_ORIGIN: "http://localhost:3000",
      },
    },
    ...(process.env.E2E_SKIP_CLIENT
      ? []
      : [
          {
            command: "pnpm --filter @vtt/client dev -- --port 3000 --strictPort",
            port: 3000,
            reuseExistingServer: !process.env.CI,
            timeout: 120000,
            env: {
              NODE_ENV: "test",
              NEXT_PUBLIC_API_URL: "http://localhost:8080",
              NEXT_PUBLIC_WS_URL: "ws://localhost:8080/ws",
              NEXT_PUBLIC_FEATURE_REAL_TIME: "true",
              NEXT_PUBLIC_FEATURE_AI: "true",
              NEXT_PUBLIC_TELEMETRY_DISABLED: "true",
            },
          },
        ]),
  ],
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  globalTeardown: require.resolve("./e2e/global-teardown.ts"),
});
