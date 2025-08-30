#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Get list of files with parsing errors
const eslintOutput = execSync("npx eslint . --ext .ts,.tsx --format json", {
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
  cwd: __dirname,
}).trim();

const results = JSON.parse(eslintOutput);
const filesWithParsingErrors = new Map();

// Collect files with parsing errors and their line numbers
for (const file of results) {
  if (file.messages && file.messages.length > 0) {
    const parsingErrors = file.messages.filter(
      (m) => m.message && m.message.includes("Parsing error"),
    );
    if (parsingErrors.length > 0) {
      filesWithParsingErrors.set(file.filePath, parsingErrors);
    }
  }
}

console.log(`Found ${filesWithParsingErrors.size} files with parsing errors`);

let totalFixed = 0;

// Process each file with parsing errors
for (const [filePath, errors] of filesWithParsingErrors) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let originalContent = content;
    let lines = content.split("\n");

    // Process each parsing error
    for (const error of errors) {
      const lineNum = error.line - 1; // Convert to 0-based index
      if (lineNum >= 0 && lineNum < lines.length) {
        let line = lines[lineNum];
        let originalLine = line;

        // Fix patterns based on error message
        if (error.message.includes("',' expected")) {
          // Pattern: (param) => should be (_param) =>
          line = line.replace(/\b_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)/g, "(_$1)");
          // Pattern: _(param: should be (_param: line = line.replace(/\b_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '(_$1:');
          // Pattern: _{ should be _{
          line = line.replace(/\b_\{/g, "_{");
        }

        if (error.message.includes("')' expected")) {
          // Pattern: functionCall(_(param) should be functionCall((_param)
          line = line.replace(/\(\s*_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)/g, "((_$1)");
          // Pattern: new Class(_(param) should be new Class((_param)
          line = line.replace(/new\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(\s*_\(/g, "new $1((");
          // Pattern in arrow functions
          line = line.replace(/\b_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g, "(_$1)");
        }

        if (line !== originalLine) {
          lines[lineNum] = line;
        }
      }
    }

    content = lines.join("\n");

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
      totalFixed++;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

console.log(`\nFixed ${totalFixed} files`);

// Run ESLint again to check progress
console.log("\nChecking remaining ESLint issues...");
try {
  const result = execSync("npx eslint . --ext .ts,.tsx 2>&1", { encoding: "utf8" });
  console.log("No ESLint errors found!");
} catch (error) {
  const output = error.stdout || error.message;
  const lines = output.split("\n");
  const errorCount = lines.find((l) => l.includes("problem"));
  if (errorCount) {
    console.log(errorCount);
  }
}
