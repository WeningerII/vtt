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

  // Fix malformed arrow functions with extra spaces and symbols
  content = content.replace(/onClick=\{?\(\) = > \{\}\}> ([^}]+)\}/g, "onClick={() => $1}");
  content = content.replace(/onChange=\{?\(e\) = > \{\}\}> ([^}]+)\}/g, "onChange={(e) => $1}");

  // Fix onClick handlers with stray function calls
  content = content.replace(/onClick=\{?\(\) => \{\}\} ([a-zA-Z_]+)\(/g, "onClick={() => $1(");
  content = content.replace(/onChange=\{?\(e\) => \{\}\} ([a-zA-Z_]+)\(/g, "onChange={(e) => $1(");

  // Fix className typo (classname -> className)
  content = content.replace(/\bclassname=/gi, "className=");

  // Fix underscore prefixed variables
  content = content.replace(/\b_isEditing\b/g, "isEditing");
  content = content.replace(/\b_isLoading\b/g, "isLoading");
  content = content.replace(/\b_onUpdate\b/g, "onUpdate");
  content = content.replace(/\b_onChange\b/g, "onChange");
  content = content.replace(/\b_onClick\b/g, "onClick");

  // Fix camelCase function names
  content = content.replace(/\bupdatecharacterfield\b/g, "updateCharacterField");
  content = content.replace(/\btogglesavingthrowproficiency\b/g, "toggleSavingThrowProficiency");
  content = content.replace(/\bhandleskilltoggle\b/g, "handleSkillToggle");
  content = content.replace(/\bhandleskillproficiencychange\b/g, "handleSkillProficiencyChange");
  content = content.replace(/\bhandleequipmentadd\b/g, "handleEquipmentAdd");
  content = content.replace(/\bhandleequipmentremove\b/g, "handleEquipmentRemove");
  content = content.replace(/\bhandlespelladd\b/g, "handleSpellAdd");
  content = content.replace(/\bhandlespellremove\b/g, "handleSpellRemove");

  // Fix stray tabIndex and aria-label after event handlers
  content = content.replace(/\}\s+tabIndex=\{[0-9]+\}/g, "}");
  content = content.replace(/\}\s+aria-label="[^"]*"/g, "}");

  // Fix malformed arrow functions in general
  content = content.replace(/=\{?\(\) = >/g, "={() =>");
  content = content.replace(/=\{?\(e\) = >/g, "(e) =>");

  // Fix double closing braces
  content = content.replace(/\}\}\}/g, "}}");

  // Fix specific patterns with onClick and empty functions
  content = content.replace(/onClick=\{?\(\) => \{\}\}/g, "onClick={() => {}}");

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
