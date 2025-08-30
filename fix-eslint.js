#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Get all TypeScript files with ESLint violations
const eslintOutput = execSync("npx eslint . --ext .ts,.tsx --format json", {
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
}).toString();
const results = JSON.parse(eslintOutput);

let totalFixed = 0;

// Process each file
results.forEach((file) => {
  if (file.messages.length === 0) return;

  let content = fs.readFileSync(file.filePath, "utf8");
  const lines = content.split("\n");
  let modified = false;

  // Sort messages by line/column in reverse to avoid position shifts
  const messages = file.messages.sort((a, b) => {
    if (b.line !== a.line) return b.line - a.line;
    return b.column - a.column;
  });

  messages.forEach((msg) => {
    const lineIdx = msg.line - 1;

    // Fix no-case-declarations - wrap in block
    if (msg.ruleId === "no-case-declarations" && lineIdx < lines.length) {
      const line = lines[lineIdx];
      const indent = line.match(/^\s*/)[0];

      // Find the case statement above
      let caseLineIdx = lineIdx - 1;
      while (
        caseLineIdx >= 0 &&
        !lines[caseLineIdx].trim().startsWith("case ") &&
        !lines[caseLineIdx].trim().startsWith("default:")
      ) {
        caseLineIdx--;
      }

      if (caseLineIdx >= 0) {
        // Find the end of this case block (next case/default/closing brace)
        let endIdx = lineIdx + 1;
        while (endIdx < lines.length) {
          const trimmed = lines[endIdx].trim();
          if (trimmed.startsWith("case ") || trimmed.startsWith("default:") || trimmed === "}") {
            break;
          }
          endIdx++;
        }

        // Add braces around the case content
        lines[caseLineIdx] = lines[caseLineIdx] + " {";
        lines.splice(endIdx, 0, indent + "}");
        modified = true;
        console.log(`Fixed no-case-declarations in ${file.filePath}:${msg.line}`);
      }
    }

    // Fix no-unused-vars - prefix with underscore
    if (msg.ruleId === "@typescript-eslint/no-unused-vars" && lineIdx < lines.length) {
      const line = lines[lineIdx];
      const match = msg.message.match(
        /'([^']+)' is (defined but never used|assigned a value but never used)/,
      );

      if (match) {
        const varName = match[1];
        // Only fix if it's a parameter or destructured variable
        const patterns = [
          new RegExp(`(\\(|,\\s*)${varName}([:,\\s\\)])`),
          new RegExp(`(const|let|var)\\s+({[^}]*)?${varName}([^\\w])`),
          new RegExp(`(\\s)${varName}(\\s*:)`),
        ];

        for (const pattern of patterns) {
          if (pattern.test(line) && !varName.startsWith("")) {
            lines[lineIdx] = line.replace(pattern, (match, p1, p2) => {
              return p1 + "" + varName + p2;
            });
            modified = true;
            console.log(`Fixed unused variable '${varName}' in ${file.filePath}:${msg.line}`);
            break;
          }
        }
      }
    }

    // Fix no-unsafe-function-type
    if (msg.ruleId === "@typescript-eslint/no-unsafe-function-type" && lineIdx < lines.length) {
      const line = lines[lineIdx];
      lines[lineIdx] = line.replace(/:\s*Function\b/g, ": (...args: any[]) => any");
      if (lines[lineIdx] !== line) {
        modified = true;
        console.log(`Fixed Function type in ${file.filePath}:${msg.line}`);
      }
    }

    // Fix no-require-imports
    if (msg.ruleId === "@typescript-eslint/no-require-imports" && lineIdx < lines.length) {
      const line = lines[lineIdx];
      const requireMatch = line.match(
        /(?:const|let|var)\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/,
      );

      if (requireMatch) {
        const [, varName, modulePath] = requireMatch;
        lines[lineIdx] = `import * as ${varName} from '${modulePath}';`;
        modified = true;
        console.log(`Fixed require import in ${file.filePath}:${msg.line}`);
      }
    }

    // Fix no-empty-object-type
    if (msg.ruleId === "@typescript-eslint/no-empty-object-type" && lineIdx < lines.length) {
      const line = lines[lineIdx];
      lines[lineIdx] = line.replace(/:\s*{}\s*([,;>\)])/g, ": Record<string, unknown>$1");
      if (lines[lineIdx] !== line) {
        modified = true;
        console.log(`Fixed empty object type in ${file.filePath}:${msg.line}`);
      }
    }

    // Fix no-useless-escape
    if (msg.ruleId === "no-useless-escape" && lineIdx < lines.length) {
      const line = lines[lineIdx];
      lines[lineIdx] = line.replace(/\\\//g, "/");
      if (lines[lineIdx] !== line) {
        modified = true;
        console.log(`Fixed useless escape in ${file.filePath}:${msg.line}`);
      }
    }
  });

  if (modified) {
    fs.writeFileSync(file.filePath, lines.join("\n"));
    totalFixed++;
  }
});

console.log(`\n✅ Fixed issues in ${totalFixed} files`);
console.log("\nRunning ESLint to verify fixes...");

// Run ESLint again to see remaining issues
execSync("npx eslint . --ext .ts,.tsx --format compact | tail -5", { stdio: "inherit" });
