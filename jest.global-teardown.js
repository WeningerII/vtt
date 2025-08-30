/**
 * Jest Global Teardown
 * Runs once after all tests complete
 */

module.exports = async () => {
  console.log("🧹 Cleaning up test environment...");

  // Cleanup any global resources
  if (global.__TEST_SERVERS__) {
    console.log("🛑 Stopping test servers...");
    for (const server of global.__TEST_SERVERS__) {
      if (server && typeof server.close === "function") {
        await new Promise((resolve) => {
          server.close(resolve);
        });
      }
    }
  }

  // Cleanup test databases
  if (global.__TEST_DB__) {
    console.log("🗑️ Cleaning up test database...");
    if (typeof global.__TEST_DB__.close === "function") {
      await global.__TEST_DB__.close();
    }
  }

  // Cleanup test cache
  if (global.__TEST_CACHE__) {
    console.log("🧽 Clearing test cache...");
    if (typeof global.__TEST_CACHE__.flushall === "function") {
      await global.__TEST_CACHE__.flushall();
    }
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  console.log("✅ Test cleanup completed");
};
