#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Run ESLint and capture output
console.log("🔍 Running ESLint to identify errors...");
let eslintOutput;
try {
  eslintOutput = execSync("pnpm run lint --format=json", {
    encoding: "utf8",
    cwd: __dirname,
  });
} catch (error) {
  // ESLint exits with error code when there are issues
  eslintOutput = error.stdout;
}

let results;
try {
  results = JSON.parse(eslintOutput);
} catch (e) {
  // Fallback to regular lint if JSON format fails
  console.log("Running standard ESLint format...");
  try {
    execSync("pnpm run lint", { stdio: "inherit", cwd: __dirname });
  } catch (error) {
    console.log("ESLint found issues. Proceeding with fixes...");
  }

  // Run auto-fix for fixable issues
  console.log("\n🔧 Running ESLint auto-fix for fixable issues...");
  try {
    execSync("npx eslint . --ext .ts,.tsx --fix", {
      stdio: "inherit",
      cwd: __dirname,
    });
    console.log("✅ Auto-fixable ESLint issues resolved");
  } catch (error) {
    console.log("⚠️ Some ESLint issues remain after auto-fix");
  }

  process.exit(0);
}

// Process JSON results if available
const errorsByFile = {};
const parsingErrors = [];

results.forEach((file) => {
  if (file.errorCount > 0 || file.warningCount > 0) {
    file.messages.forEach((msg) => {
      if (msg.message.includes("Parsing error")) {
        parsingErrors.push({
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          message: msg.message,
        });
      }
    });
  }
});

console.log(`\n📊 Found ${parsingErrors.length} parsing errors to fix`);

// Auto-fix what we can
console.log("\n🔧 Running ESLint auto-fix...");
try {
  execSync("npx eslint . --ext .ts,.tsx --fix", {
    stdio: "inherit",
    cwd: __dirname,
  });
  console.log("✅ Auto-fixable issues resolved");
} catch (error) {
  console.log("⚠️ Some issues remain after auto-fix");
}

// Report remaining parsing errors
if (parsingErrors.length > 0) {
  console.log("\n⚠️ Remaining parsing errors that need manual fixing:");
  parsingErrors.forEach((err) => {
    console.log(`  ${err.file}:${err.line}:${err.column} - ${err.message}`);
  });
}

console.log("\n✨ ESLint fix process completed");
