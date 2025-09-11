import { chromium, FullConfig } from "@playwright/test";
import { join } from "path";

async function globalSetup(_config: FullConfig) {
  console.log("[E2E Setup] Starting comprehensive test environment...");

  // Load test environment variables (optional)
  try {
    const dotenv = await import("dotenv");
    dotenv.default.config({ path: join(process.cwd(), ".env.test") });
  } catch {
    console.log("[E2E Setup] dotenv not installed; skipping .env.test loading");
  }

  // Setup test database with proper error handling
  const skipDb = !!process.env.E2E_SKIP_DB || !!process.env.E2E_SKIP_DB_SETUP;
  if (skipDb) {
    console.log("[E2E Setup] Skipping DB setup/seed (E2E_SKIP_DB)");
  } else {
    try {
      console.log("[E2E Setup] Setting up test database...");
      const { testDb } = await import("./utils/database");
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
        
        // If client is not skipped, check client readiness
        if (!skipClient) {
          try {
            const clientResponse = await page.request.get("http://localhost:3000/");
            if (clientResponse.status() === 200) {
              console.log("[E2E Setup] Client is ready");
              clientReady = true;
            }
          } catch (clientError) {
            console.log(`[E2E Setup] Client not ready yet: ${clientError}`);
          }
        }
        
        break; // Exit retry loop when server is ready
      }
    } catch (error) {
      console.log(`[E2E Setup] Attempt ${i + 1}/${maxRetries} failed, retrying...`);
      if (i === maxRetries - 1) {
        console.error("[E2E Setup] Server failed to start:", error);
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
