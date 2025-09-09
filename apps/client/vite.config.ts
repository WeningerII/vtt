import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Help Vite/Rollup resolve workspace packages under pnpm
    alias: {
      "@vtt/core-schemas": fileURLToPath(
        new URL("../../packages/core-schemas/src/index.ts", import.meta.url),
      ),
      "@vtt/logging": fileURLToPath(new URL("./src/lib/logger.ts", import.meta.url)),
      "@vtt/i18n": fileURLToPath(new URL("../../packages/i18n/src/index.ts", import.meta.url)),
    },
    preserveSymlinks: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Conservative vendor chunking to avoid resolution errors
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: true,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      "/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/docs": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/api-docs.json": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
  preview: {
    port: 5175,
    host: true,
  },
});
