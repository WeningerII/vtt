#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript/TSX files
const files = glob.sync('apps/client/src/**/*.{ts,tsx}');

let totalFixed = 0;
let fixedFiles = [];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Fix onClick handlers that still have malformed syntax
  // Pattern: onClick={() => updateCharacterField('inspiration', !character.inspiration)}
  content = content.replace(/onClick=\{?\(\) => \{\}\}/g, 'onClick={() => {}}');
  
  // Fix the specific pattern with function calls after =>
  content = content.replace(/onClick=\{?\(\) => \{\}\} ([a-zA-Z]+)\(/g, 'onClick={() => $1(');
  
  // Fix onChange handlers with (e) =>
  content = content.replace(/onChange=\{?\(e\) =>/g, 'onChange={(e) =>');
  
  // Fix onSubmit handlers
  content = content.replace(/onSubmit=\{?\(e\) =>/g, 'onSubmit={(e) =>');
  
  // Fix handlers that have extra closing braces
  content = content.replace(/onClick=\{?\(\) => ([^}]+)\}\}/g, 'onClick={() => $1}');
  
  // Fix stray function calls that appear after event handlers
  // Pattern: onClick={() => {}} updateCharacterField('inspiration', !character.inspiration)}
  content = content.replace(/onClick=\{?\(\) => \{\}\}\s+([a-zA-Z]+\([^)]+\))\}/g, 'onClick={() => $1}');
  
  // Fix onChange with stray function calls
  content = content.replace(/onChange=\{?\(e\) => \{\}\}\s+([a-zA-Z]+\([^)]+\))\}/g, 'onChange={(e) => $1}');
  
  // Fix specific patterns in character components
  content = content.replace(/onClick=\{?\(\) => \{\}\}\s+updateCharacterField\(/g, 'onClick={() => updateCharacterField(');
  content = content.replace(/onClick=\{?\(\) => \{\}\}\s+toggleSavingThrowProficiency\(/g, 'onClick={() => toggleSavingThrowProficiency(');
  content = content.replace(/onClick=\{?\(\) => \{\}\}\s+handleSkillToggle\(/g, 'onClick={() => handleSkillToggle(');
  content = content.replace(/onChange=\{?\(e\) => \{\}\}\s+handleSkillProficiencyChange\(/g, 'onChange={(e) => handleSkillProficiencyChange(');
  
  // Fix patterns where the function call is split
  content = content.replace(/onClick=\{?\(\) => \{\}\}\s+aria-label="([^"]+)"/g, (match, label) => {
    // Extract function call from aria-label if it looks like a function
    if (label.includes('(')) {
      return `onClick={() => ${label}}`;
    }
    return `onClick={() => {}}`;
  });
  
  // Remove stray aria-label after fixed handlers
  content = content.replace(/(\}\s*)aria-label="[^"]*"/g, '$1');
  
  // Fix tabIndex that appears in wrong places
  content = content.replace(/tabIndex=\{[0-9]+\}>/g, '>');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`Fixed: ${file}`);
    fixedFiles.push(file);
    totalFixed++;
  }
});

console.log(`\nTotal files fixed: ${totalFixed}`);
if (fixedFiles.length > 0) {
  console.log('\nFixed files:');
  fixedFiles.forEach(f => console.log(`  - ${f}`));
}
