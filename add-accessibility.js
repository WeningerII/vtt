#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(function(file) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });
  
  return arrayOfFiles;
}

function addAccessibilityFeatures(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Add tabIndex to interactive elements without it
  const buttonPattern = /<button([^>]*?)>/g;
  const matches = content.match(buttonPattern);
  if (matches) {
    matches.forEach(match => {
      if (!match.includes('tabIndex')) {
        const newMatch = match.replace('>', ' tabIndex={0}>');
        content = content.replace(match, newMatch);
        modified = true;
      }
    });
  }
  
  // Add role="button" and tabIndex to clickable divs
  const clickableDivPattern = /<div([^>]*?)onClick={[^}]+}([^>]*?)>/g;
  content = content.replace(clickableDivPattern, (match, before, after) => {
    let newMatch = match;
    if (!match.includes('role=')) {
      newMatch = newMatch.replace('<div', '<div role="button"');
      modified = true;
    }
    if (!match.includes('tabIndex')) {
      newMatch = newMatch.replace('>', ' tabIndex={0}>');
      modified = true;
    }
    return newMatch;
  });
  
  // Add aria-describedby for form fields with error messages
  const inputPattern = /<input([^>]*?)>/g;
  const inputMatches = content.match(inputPattern);
  if (inputMatches) {
    inputMatches.forEach(match => {
      if (!match.includes('aria-describedby') && !match.includes('aria-label')) {
        // Try to find associated label or placeholder
        const idMatch = match.match(/id="([^"]*)"/);
        if (idMatch) {
          const id = idMatch[1];
          const newMatch = match.replace('>', ` aria-describedby="${id}-error">`);
          content = content.replace(match, newMatch);
          modified = true;
        }
      }
    });
  }
  
  // Add focus-visible styles (ensure keyboard focus is visible)
  if (content.includes('.css') && !content.includes('focus-visible')) {
    const cssImport = content.match(/import ['"]([^'"]*\.css)['"]/);
    if (cssImport) {
      const cssPath = path.join(path.dirname(filePath), cssImport[1]);
      if (fs.existsSync(cssPath)) {
        let cssContent = fs.readFileSync(cssPath, 'utf8');
        if (!cssContent.includes('focus-visible')) {
          cssContent += `
/* Keyboard focus styles for accessibility */
button:focus-visible,
[role="button"]:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabIndex]:focus-visible {
  outline: 2px solid #4A90E2;
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
button:focus:not(:focus-visible),
[role="button"]:focus:not(:focus-visible) {
  outline: none;
}
`;
          fs.writeFileSync(cssPath, cssContent, 'utf8');
        }
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Get all TSX files
const componentsDir = '/home/weningerii/vtt/apps/client/src/components';
const files = getAllFiles(componentsDir);

let fixedCount = 0;
files.forEach(file => {
  if (addAccessibilityFeatures(file)) {
    console.log(`Enhanced accessibility in: ${path.relative(componentsDir, file)}`);
    fixedCount++;
  }
});

console.log(`\nEnhanced accessibility in ${fixedCount} files`);
