#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";

// Get staged files
const stagedFiles = execSync("git diff --cached --name-only", { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((file) => fs.existsSync(file)); // Only process files that exist

if (stagedFiles.length === 0) {
  console.log("No staged files found");
  process.exit(0);
}

// Filter files by type and exclude node_modules
const jsFiles = stagedFiles.filter(
  (file) => /\.(js|jsx|ts|tsx)$/.test(file) && !file.includes("node_modules"),
);
const otherFiles = stagedFiles.filter(
  (file) => /\.(css|md|yml|yaml|json)$/.test(file) && !file.includes("node_modules"),
);

try {
  // Run prettier on JS files
  if (jsFiles.length > 0) {
    console.log("Running prettier on JS/TS files...");
    execSync(`npx prettier --write ${jsFiles.join(" ")}`, { stdio: "pipe" });

    console.log("Running eslint on JS/TS files...");
    try {
      execSync(`npx eslint --fix ${jsFiles.join(" ")}`, { stdio: "pipe" });
    } catch (eslintError) {
      // Continue even if ESLint has warnings
      console.log("ESLint completed with warnings (continuing...)");
    }

    // Re-stage the fixed files
    execSync(`git add ${jsFiles.join(" ")}`);
  }

  // Run prettier on other files
  if (otherFiles.length > 0) {
    console.log("Running prettier on other files...");
    execSync(`npx prettier --write ${otherFiles.join(" ")}`, { stdio: "pipe" });

    // Re-stage the fixed files
    execSync(`git add ${otherFiles.join(" ")}`);
  }

  console.log("✓ All files processed successfully");
} catch (error) {
  console.error("✗ Linting failed:", error.message);
  process.exit(1);
}
