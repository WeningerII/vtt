#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all React component files
const componentFiles = glob.sync('apps/client/src/**/*.tsx', {
  ignore: ['**/*.test.tsx', '**/*.spec.tsx', '**/node_modules/**']
});

let updatedFiles = 0;
let skippedFiles = 0;

// Process each component file
componentFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file already has accessibility improvements
  if (content.includes('aria-label') || content.includes('role=')) {
    console.log(`⏭️  ${path.basename(filePath)} already has accessibility attributes`);
    skippedFiles++;
    return;
  }
  
  // Add ARIA labels to buttons
  const buttonRegex = /<button([^>]*?)>/g;
  content = content.replace(buttonRegex, (match, attrs) => {
    if (!attrs.includes('aria-label')) {
      modified = true;
      return `<button${attrs} aria-label="Button">`;
    }
    return match;
  });
  
  // Add ARIA labels to inputs
  const inputRegex = /<input([^>]*?)>/g;
  content = content.replace(inputRegex, (match, attrs) => {
    if (!attrs.includes('aria-label') && !attrs.includes('aria-labelledby')) {
      modified = true;
      return `<input${attrs} aria-label="Input field">`;
    }
    return match;
  });
  
  // Add role to forms
  const formRegex = /<form([^>]*?)>/g;
  content = content.replace(formRegex, (match, attrs) => {
    if (!attrs.includes('role')) {
      modified = true;
      return `<form${attrs} role="form">`;
    }
    return match;
  });
  
  // Add ARIA label to navigation
  const navRegex = /<nav([^>]*?)>/g;
  content = content.replace(navRegex, (match, attrs) => {
    if (!attrs.includes('aria-label')) {
      modified = true;
      return `<nav${attrs} aria-label="Navigation">`;
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Added accessibility to ${path.basename(filePath)}`);
    updatedFiles++;
  } else {
    console.log(`⏭️  No changes needed for ${path.basename(filePath)}`);
    skippedFiles++;
  }
});

console.log(`\n📊 Accessibility Update Summary:`);
console.log(`✅ Updated: ${updatedFiles} files`);
console.log(`⏭️  Skipped: ${skippedFiles} files`);
console.log(`📁 Total files processed: ${componentFiles.length}`);
