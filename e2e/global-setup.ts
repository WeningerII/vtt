import { chromium, FullConfig } from "@playwright/test";
import { testDb } from "./utils/database";
import { join } from "path";
import dotenv from "dotenv";

async function globalSetup(_config: FullConfig) {
  console.log("[E2E Setup] Starting comprehensive test environment...");

  // Load test environment variables
  dotenv.config({ path: join(process.cwd(), ".env.test") });

  // Setup test database
  const skipDb = !!process.env.E2E_SKIP_DB || !!process.env.E2E_SKIP_DB_SETUP;
  if (skipDb) {
    console.log("[E2E Setup] Skipping DB setup/seed (E2E_SKIP_DB)");
  } else {
    await testDb.setup();
    await testDb.seed();
  }

  // Wait for services to be ready (webServer handles startup)
  console.log("[E2E Setup] Waiting for services to be ready...");

  // Health check with retry logic
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let serverReady = false;
  const skipClient = !!process.env.E2E_SKIP_CLIENT;
  let clientReady = skipClient; // if skipping client, treat as ready

  const maxRetries = 10;
  const retryDelay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Wait for server to be ready
      const response = await page.request.get("http://localhost:8080/livez");
      if (response.status() === 200) {
        console.log("[E2E Setup] Server is ready");
        serverReady = true;
        break; // Success - exit retry loop for API tests
      }
    } catch (error) {
      console.log(`[E2E Setup] Attempt ${i + 1}/${maxRetries} failed, retrying...`);
      if (i === maxRetries - 1) {
        console.error("[E2E Setup] Server failed to start:", error);
        throw new Error("Test environment setup failed - server not ready");
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  await browser.close();

  if (!serverReady || (!clientReady && !skipClient)) {
    throw new Error("Test environment setup failed - services not ready after maximum retries");
  }

  console.log("[E2E Setup] All services ready - test environment initialized");
}

export default globalSetup;
