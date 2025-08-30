import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@vtt/core-schemas": path.resolve(__dirname, "../core-schemas/src"),
      "@vtt/content-5e-srd": path.resolve(__dirname, "../content-5e-srd/src"),
    },
  },
});
