import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    coverage: {
      provider: "c8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.d.ts", "**/*.test.ts", "**/*.spec.ts"],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
  resolve: {
    alias: {
      "@vtt/core-ecs": "../core-ecs/src",
      "@vtt/rules-5e": "../rules-5e/src",
      "@vtt/physics": "../physics/src",
      "@vtt/net": "../net/src",
      "@vtt/analytics": "../analytics/src",
      "@vtt/scripting": "../scripting/src",
      "@vtt/renderer": "../renderer/src",
    },
  },
});
