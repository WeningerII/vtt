#!/usr/bin/env node

/**
 * Build optimization script for VTT monorepo
 * Configures TypeScript for incremental compilation and optimizes Turbo caching
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Enable TypeScript incremental compilation for all packages
function enableIncrementalCompilation() {
  const packagesDir = path.join(__dirname, "..", "packages");
  const packages = fs.readdirSync(packagesDir);

  packages.forEach((pkg) => {
    const tsconfigPath = path.join(packagesDir, pkg, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));

      // Enable incremental compilation
      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
      }

      tsconfig.compilerOptions.incremental = true;
      tsconfig.compilerOptions.tsBuildInfoFile = `./${pkg}.tsbuildinfo`;

      // Enable composite for project references
      tsconfig.compilerOptions.composite = true;

      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
      console.log(`✅ Enabled incremental compilation for @vtt/${pkg}`);
    }
  });
}

// Clear Turbo cache to ensure fresh builds
function clearTurboCache() {
  try {
    execSync("pnpm turbo daemon stop", { stdio: "inherit" });
    execSync("rm -rf .turbo node_modules/.cache/turbo", { stdio: "inherit" });
    console.log("✅ Cleared Turbo cache");
  } catch (error) {
    console.warn("⚠️  Could not clear Turbo cache:", error.message);
  }
}

// Optimize pnpm settings for faster installs
function optimizePnpm() {
  const npmrcPath = path.join(__dirname, "..", ".npmrc");
  const npmrcContent = `
# Performance optimizations
shamefully-hoist=true
strict-peer-dependencies=false
auto-install-peers=true
dedupe-peer-dependents=true
prefer-workspace-packages=true
shared-workspace-lockfile=true
recursive-install=true
enable-pre-post-scripts=false

# Cache settings
store-dir=.pnpm-store
cache-dir=.pnpm-cache
state-dir=.pnpm-state

# Network settings
network-timeout=60000
fetch-retries=3
fetch-retry-factor=2
fetch-retry-mintimeout=10000
fetch-retry-maxtimeout=60000
`;

  fs.writeFileSync(npmrcPath, npmrcContent.trim());
  console.log("✅ Optimized pnpm configuration");
}

// Create build cache warming script
function createCacheWarmingScript() {
  const scriptPath = path.join(__dirname, "warm-cache.sh");
  const scriptContent = `#!/bin/bash

# Warm build cache for frequently changed packages
echo "🔥 Warming build cache..."

# Build core packages in parallel
pnpm turbo run build --filter=@vtt/core* --filter=@vtt/rules* --filter=@vtt/net --filter=@vtt/performance --concurrency=4

# Pre-compile test files
pnpm turbo run typecheck --filter=@vtt/* --concurrency=4

echo "✅ Cache warmed successfully"
`;

  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, "755");
  console.log("✅ Created cache warming script");
}

// Main execution
console.log("🚀 Starting build optimization...\n");

enableIncrementalCompilation();
clearTurboCache();
optimizePnpm();
createCacheWarmingScript();

console.log("\n✨ Build optimization complete!");
console.log('Run "pnpm install" to apply pnpm optimizations');
console.log('Run "./scripts/warm-cache.sh" to pre-warm the build cache');
