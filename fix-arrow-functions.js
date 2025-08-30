#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Find all TypeScript/TSX files
const files = glob.sync("apps/client/src/**/*.{ts,tsx}");

let totalFixed = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let originalContent = content;

  // Fix malformed arrow functions with aria-label
  content = content.replace(
    /onClick=\{?\(\(\) = aria-label="[^"]*"[^>]*> ([^}]+)\}\)/g,
    "onClick={() => $1}",
  );

  // Fix other malformed arrow functions
  content = content.replace(/onClick=\{?\(\(\) = ([^>]+)> ([^}]+)\}\)/g, "onClick={() => $2}");

  // Fix onChange handlers
  content = content.replace(
    /onChange=\{?\(\(\) = aria-label="[^"]*"[^>]*> ([^}]+)\}\)/g,
    "onChange={() => $1}",
  );
  content = content.replace(/onChange=\{?\(\(\) = ([^>]+)> ([^}]+)\}\)/g, "onChange={() => $2}");

  // Fix onSubmit handlers
  content = content.replace(/onSubmit=\{?\(\(\) = ([^>]+)> ([^}]+)\}\)/g, "onSubmit={() => $2}");

  // Fix other event handlers
  content = content.replace(
    /on([A-Z][a-zA-Z]+)=\{?\(\(\) = aria-label="[^"]*"[^>]*> ([^}]+)\}\)/g,
    "on$1={() => $2}",
  );
  content = content.replace(
    /on([A-Z][a-zA-Z]+)=\{?\(\(\) = ([^>]+)> ([^}]+)\}\)/g,
    "on$1={() => $3}",
  );

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Fixed: ${file}`);
    totalFixed++;
  }
});

console.log(`\nTotal files fixed: ${totalFixed}`);
