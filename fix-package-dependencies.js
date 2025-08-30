#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Script to add missing dependencies to package.json
 */

class DependencyFixer {
  constructor() {
    this.missingDeps = ["axios", "clsx", "cors", "lodash", "lucide-react", "tailwind-merge"];

    this.added = [];
    this.failed = [];
  }

  checkAndAddDependency(dep, isDev = false) {
    try {
      console.log(`📦 Adding ${dep}...`);

      // Check if already installed
      const packageJson = JSON.parse(fs.readFileSync("/home/weningerii/vtt/package.json", "utf8"));

      if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
        console.log(`  ✓ Already installed: ${dep}`);
        return;
      }

      // Determine appropriate version based on common usage
      const versions = {
        axios: "^1.6.0",
        clsx: "^2.1.0",
        cors: "^2.8.5",
        lodash: "^4.17.21",
        "lucide-react": "^0.294.0",
        "tailwind-merge": "^2.2.0",
      };

      // Add to package.json
      if (!packageJson.dependencies) packageJson.dependencies = {};
      packageJson.dependencies[dep] = versions[dep] || "latest";

      // Write updated package.json
      fs.writeFileSync(
        "/home/weningerii/vtt/package.json",
        JSON.stringify(packageJson, null, 2) + "\n",
      );

      this.added.push(dep);
      console.log(`  ✅ Added ${dep} to package.json`);
    } catch (error) {
      this.failed.push({ dep, error: error.message });
      console.log(`  ❌ Failed to add ${dep}: ${error.message}`);
    }
  }

  cleanupUnusedDependencies() {
    const unused = [
      "@vtt/ai",
      "@vtt/auth",
      "@vtt/conditions-engine",
      "@vtt/content-5e-srd",
      "@vtt/core",
      "@vtt/core-ecs",
      "@vtt/core-schemas",
      "@vtt/dice-engine",
      "@vtt/monitoring",
      "@vtt/net",
      "@vtt/performance",
      "@vtt/physics",
      "@vtt/physics-spell-bridge",
      "@vtt/renderer",
      "@vtt/rules-5e",
      "@vtt/spell-engine",
      "@vtt/testing",
    ];

    console.log("\n🧹 Marking unused dependencies for review...\n");

    try {
      const packageJson = JSON.parse(fs.readFileSync("/home/weningerii/vtt/package.json", "utf8"));

      // Add comment to package.json about unused deps
      if (!packageJson["//"]) {
        packageJson["//"] = {};
      }

      packageJson["//"]["unused-dependencies"] = {
        note: "These dependencies were detected as unused in the audit",
        date: new Date().toISOString(),
        packages: unused.filter(
          (dep) => packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep],
        ),
      };

      fs.writeFileSync(
        "/home/weningerii/vtt/package.json",
        JSON.stringify(packageJson, null, 2) + "\n",
      );

      console.log("✅ Marked unused dependencies in package.json comments");
    } catch (error) {
      console.log(`❌ Failed to mark unused deps: ${error.message}`);
    }
  }

  updateWorkspaceDependencies() {
    const workspaces = [
      "/home/weningerii/vtt/apps/client",
      "/home/weningerii/vtt/apps/server",
      "/home/weningerii/vtt/apps/editor",
    ];

    console.log("\n📦 Updating workspace dependencies...\n");

    workspaces.forEach((workspace) => {
      const pkgPath = path.join(workspace, "package.json");

      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          let updated = false;

          // Add missing UI library deps to client/editor
          if (workspace.includes("client") || workspace.includes("editor")) {
            if (!pkg.dependencies) pkg.dependencies = {};

            if (!pkg.dependencies["clsx"]) {
              pkg.dependencies["clsx"] = "^2.1.0";
              updated = true;
            }

            if (!pkg.dependencies["tailwind-merge"]) {
              pkg.dependencies["tailwind-merge"] = "^2.2.0";
              updated = true;
            }

            if (!pkg.dependencies["lucide-react"]) {
              pkg.dependencies["lucide-react"] = "^0.294.0";
              updated = true;
            }
          }

          // Add server deps
          if (workspace.includes("server")) {
            if (!pkg.dependencies) pkg.dependencies = {};

            if (!pkg.dependencies["cors"]) {
              pkg.dependencies["cors"] = "^2.8.5";
              updated = true;
            }

            if (!pkg.dependencies["axios"]) {
              pkg.dependencies["axios"] = "^1.6.0";
              updated = true;
            }
          }

          if (updated) {
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
            console.log(`✅ Updated ${workspace}/package.json`);
          }
        } catch (error) {
          console.log(`❌ Failed to update ${workspace}: ${error.message}`);
        }
      }
    });
  }

  generateReport() {
    console.log("\n=== DEPENDENCY FIX REPORT ===\n");

    if (this.added.length > 0) {
      console.log("✅ Added dependencies:");
      this.added.forEach((dep) => console.log(`  • ${dep}`));
    }

    if (this.failed.length > 0) {
      console.log("\n❌ Failed to add:");
      this.failed.forEach(({ dep, error }) => {
        console.log(`  • ${dep}: ${error}`);
      });
    }

    console.log("\n📝 Next steps:");
    console.log("  1. Run: pnpm install");
    console.log("  2. Verify builds: pnpm build");
    console.log("  3. Run tests: pnpm test");
    console.log("  4. Review unused dependencies marked in package.json");
  }
}

// Main execution
console.log("🔧 Fixing package.json dependencies...\n");

const fixer = new DependencyFixer();

// Add missing dependencies
fixer.missingDeps.forEach((dep) => {
  fixer.checkAndAddDependency(dep);
});

// Update workspace-specific dependencies
fixer.updateWorkspaceDependencies();

// Mark unused dependencies
fixer.cleanupUnusedDependencies();

// Generate report
fixer.generateReport();
