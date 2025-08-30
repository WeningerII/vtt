#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Find all TypeScript/TSX files
const files = glob.sync("apps/client/src/**/*.{ts,tsx}");

let totalFixed = 0;
let fixedFiles = [];

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let originalContent = content;

  // Fix malformed onClick handlers with tabIndex and aria-label
  content = content.replace(
    /onClick=\{?\(\(\) = tabIndex=\{[0-9]+\}> \{\}\} aria-label="([^"]+)"/g,
    (match, action) => {
      // Extract the actual function call from the aria-label
      return `onClick={() => ${action}}`;
    },
  );

  // Fix malformed onChange handlers with aria-label
  content = content.replace(/onChange=\{?\(e\) = aria-label="([^"]+)">/g, (match, label) => {
    return `onChange={(e) =>`;
  });

  // Fix className typo (classname -> className)
  content = content.replace(/\bclassname=/g, "className=");

  // Fix _isediting -> isEditing
  content = content.replace(/\b_isediting\b/g, "isEditing");

  // Fix other underscore prefixed variables
  content = content.replace(/\b_isloading\b/g, "isLoading");
  content = content.replace(/\b_iserror\b/g, "isError");

  // Fix malformed function calls in onClick/onChange
  content = content.replace(/updatecharacterfield/g, "updateCharacterField");
  content = content.replace(/togglesavingthrowproficiency/g, "toggleSavingThrowProficiency");
  content = content.replace(/handleskilltoggle/g, "handleSkillToggle");
  content = content.replace(/handleskillproficiencychange/g, "handleSkillProficiencyChange");

  // Fix stray aria-label attributes after event handlers
  content = content.replace(/\}\s+aria-label="[^"]*"/g, "}");

  // Fix malformed arrow functions in general
  content = content.replace(/=\{?\(\(\) = [^>]+> /g, "={() => ");
  content = content.replace(/=\{?\(e\) = [^>]+> /g, "(e) => ");

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Fixed: ${file}`);
    fixedFiles.push(file);
    totalFixed++;
  }
});

console.log(`\nTotal files fixed: ${totalFixed}`);
if (fixedFiles.length > 0) {
  console.log("\nFixed files:");
  fixedFiles.forEach((f) => console.log(`  - ${f}`));
}
