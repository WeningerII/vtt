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
          // Vendor chunks for better caching
          "react-vendor": ["react", "react-dom"],
          "ui-vendor": ["@headlessui/react", "@heroicons/react"],
          "game-vendor": ["three", "cannon-es"],
          "utils-vendor": ["lodash", "date-fns", "uuid"],

          // Feature-based chunks
          auth: [
            "./src/components/auth/LoginForm",
            "./src/components/auth/RegisterForm",
            "./src/providers/AuthProvider",
          ],
          "game-canvas": ["./src/components/GameCanvas", "./src/components/MapEditor"],
          "character-management": [
            "./src/components/CharacterSheet",
            "./src/components/character/AbilityScores",
            "./src/components/character/EquipmentPanel",
            "./src/components/character/SpellsPanel",
          ],
          "monster-browser": [
            "./src/components/MonsterBrowser",
            "./src/components/EncounterGenerator",
          ],
          combat: [
            "./src/components/CombatTracker",
            "./src/components/combat/CombatEncounterPanel",
          ],
          "ai-features": [
            "./src/components/AIAssistant",
            "./src/components/ai/CombatAssistant",
            "./src/components/ai/GenesisWizard",
          ],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },
  preview: {
    port: 5175,
    host: true,
  },
});
