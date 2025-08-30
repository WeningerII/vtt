#!/usr/bin/env node

import fs from "fs";
import path from "path";
import glob from "glob";

// Find all TypeScript and JSX files
const files = glob.sync("**/*.{ts,tsx,js,jsx}", {
  ignore: ["node_modules/**", "dist/**", "build/**", ".pnpm-store/**", "coverage/**"],
  absolute: true,
});

console.log(`Processing ${files.length} files for destructuring fixes...`);

let fixedCount = 0;

for (const filePath of files) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    let originalContent = content;

    // Fix destructuring patterns with misplaced underscores
    // Pattern 1: ({_prop1, _prop2}) => should be ({_prop1, _prop2}) =>
    content = content.replace(/\(_\{([^}]+)\}\)/g, (match, props) => {
      // Add underscore to each property in the destructuring
      const fixedProps = props
        .split(",")
        .map((prop) => {
          const trimmed = prop.trim();
          if (trimmed && !trimmed.startsWith("")) {
            return "" + trimmed;
          }
          return trimmed;
        })
        .join(", ");
      return "({" + fixedProps + "})";
    });

    // Pattern 2: = ({_prop}) should be = ({_prop})
    content = content.replace(/=\s*\(_\{([^}]+)\}/g, (match, props) => {
      const fixedProps = props
        .split(",")
        .map((prop) => {
          const trimmed = prop.trim();
          if (trimmed && !trimmed.startsWith("")) {
            return "" + trimmed;
          }
          return trimmed;
        })
        .join(", ");
      return "= ({" + fixedProps + "}";
    });

    // Pattern 3: React.FC<Props> = ({_prop}) should be = ({_prop})
    content = content.replace(/React\.FC<[^>]+>\s*=\s*\(_\{/g, (match) => {
      return match.replace(/\(_\{/g, "({");
    });

    // Pattern 4: More general pattern for arrow functions with destructured params
    content = content.replace(/\(_\{/g, "({");
    content = content.replace(/_\{([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,/g, "{_$1,");
    content = content.replace(/,\s*_([a-zA-Z_$][a-zA-Z0-9_$]*)\s*([,}])/g, ", _$1$2");

    // Pattern 5: Fix array destructuring
    content = content.replace(/\(_\[([^\]]+)\]\)/g, "([_$1])");

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedCount++;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

console.log(`\nFixed ${fixedCount} files`);

// Run ESLint to check remaining issues
console.log("\nChecking remaining ESLint issues...");
import { execSync } from "child_process";
try {
  const result = execSync("npx eslint . --ext .ts,.tsx 2>&1", { encoding: "utf8" });
  console.log("✅ No ESLint errors found!");
} catch (error) {
  const output = error.stdout || error.message;
  const lines = output.split("\n");
  const errorCount = lines.find((l) => l.includes("problem"));
  if (errorCount) {
    console.log(errorCount);
  }
}
