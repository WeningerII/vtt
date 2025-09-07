import { chromium, FullConfig } from "@playwright/test";
import { testDb } from "./utils/database";
import { join } from "path";
import dotenv from "dotenv";

async function globalSetup(_config: FullConfig) {
  console.log("[E2E Setup] Starting comprehensive test environment...");

  // Load test environment variables
  dotenv.config({ path: join(process.cwd(), ".env.test") });

  // Setup test database with proper error handling
  const skipDb = !!process.env.E2E_SKIP_DB || !!process.env.E2E_SKIP_DB_SETUP;
  if (skipDb) {
    console.log("[E2E Setup] Skipping DB setup/seed (E2E_SKIP_DB)");
  } else {
    try {
      console.log("[E2E Setup] Setting up test database...");
      await testDb.setup();
      console.log("[E2E Setup] Seeding test data...");  
      await testDb.seed();
      console.log("[E2E Setup] Database setup complete");
    } catch (error) {
      console.error("[E2E Setup] Database setup failed:", error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  // Wait for services to be ready (webServer handles startup)
  console.log("[E2E Setup] Waiting for services to be ready...");

  // Health check with retry logic
  const browser = await chromium.launch();
  const page = await browser.newPage();

  let serverReady = false;
  const skipClient = !!process.env.E2E_SKIP_CLIENT;
  const clientReady = skipClient; // if skipping client, treat as ready

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
