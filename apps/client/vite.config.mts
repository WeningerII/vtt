import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite";

// Vite 7 expects Node's newer crypto.hash API. Provide a backward-compatible shim for older runtimes.
if (typeof (crypto as unknown as { hash?: unknown }).hash !== "function") {
  (crypto as unknown as { hash: (algorithm: string, data: string | ArrayBufferView, encoding?: crypto.BinaryToTextEncoding) => string | Buffer }).hash = (
    algorithm,
    data,
    encoding,
  ) => {
    const hasher = crypto.createHash(algorithm);
    if (typeof data === "string") {
      hasher.update(data);
    } else {
      hasher.update(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    }
    return encoding ? hasher.digest(encoding) : hasher.digest();
  };
}

// https://vitejs.dev/config/
const config: UserConfig = {
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
};

export default config;
