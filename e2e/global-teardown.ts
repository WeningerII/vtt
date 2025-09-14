import { FullConfig } from "@playwright/test";
import { testDb } from "./utils/database";

async function globalTeardown(_config: FullConfig) {
  console.log("[E2E Teardown] Cleaning up test environment...");

  try {
    const skipDb = !!process.env.E2E_SKIP_DB || !!process.env.E2E_SKIP_DB_SETUP;
    if (skipDb) {
      console.log("[E2E Teardown] Skipping DB cleanup (E2E_SKIP_DB)");
    } else {
      // Cleanup test database
      await testDb.cleanup();
    }

    console.log("[E2E Teardown] Database cleanup complete");
  } catch (error) {
    console.error("[E2E Teardown] Error during cleanup:", error);
  }

  console.log("[E2E Teardown] Complete");
}

export default globalTeardown;
