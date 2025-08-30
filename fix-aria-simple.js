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

function fixAriaLabels(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix generic button aria-labels
  if (content.includes('aria-label="Button"')) {
    // Simple replacements based on common button text patterns
    content = content.replace(/aria-label="Button">(\s*)Try Again/g, 'aria-label="Try again after error">$1Try Again');
    content = content.replace(/aria-label="Button">(\s*)Retry/g, 'aria-label="Retry loading">$1Retry');
    content = content.replace(/aria-label="Button">(\s*)Previous/g, 'aria-label="Go to previous page">$1Previous');
    content = content.replace(/aria-label="Button">(\s*)Next/g, 'aria-label="Go to next page">$1Next');
    content = content.replace(/aria-label="Button">(\s*)End Combat/g, 'aria-label="End combat">$1End Combat');
    content = content.replace(/aria-label="Button">(\s*)Start Combat/g, 'aria-label="Start combat">$1Start Combat');
    content = content.replace(/aria-label="Button">(\s*)Add Combatant/g, 'aria-label="Add combatant">$1Add Combatant');
    content = content.replace(/aria-label="Button">(\s*)Cancel/g, 'aria-label="Cancel action">$1Cancel');
    content = content.replace(/aria-label="Button">(\s*)Send/g, 'aria-label="Send message">$1Send');
    content = content.replace(/aria-label="Button">(\s*)Roll Dice/g, 'aria-label="Roll dice">$1Roll Dice');
    content = content.replace(/aria-label="Button">(\s*)×/g, 'aria-label="Close">$1×');
    content = content.replace(/aria-label="Button">(\s*)Save/g, 'aria-label="Save changes">$1Save');
    content = content.replace(/aria-label="Button">(\s*)Submit/g, 'aria-label="Submit form">$1Submit');
    content = content.replace(/aria-label="Button">(\s*)Login/g, 'aria-label="Login to account">$1Login');
    content = content.replace(/aria-label="Button">(\s*)Register/g, 'aria-label="Register account">$1Register');
    content = content.replace(/aria-label="Button">(\s*)Join Campaign/g, 'aria-label="Join campaign">$1Join Campaign');
    content = content.replace(/aria-label="Button">(\s*)Generate Encounter/g, 'aria-label="Generate encounter">$1Generate Encounter');
    content = content.replace(/aria-label="Button">(\s*)Use This Encounter/g, 'aria-label="Use this encounter">$1Use This Encounter');
    content = content.replace(/aria-label="Button">(\s*)Generate Another/g, 'aria-label="Generate another encounter">$1Generate Another');
    content = content.replace(/aria-label="Button">(\s*)Create Encounter/g, 'aria-label="Create new encounter">$1Create Encounter');
    content = content.replace(/aria-label="Button">(\s*)Next Turn/g, 'aria-label="Go to next turn">$1Next Turn');
    content = content.replace(/aria-label="Button">(\s*)Add/g, 'aria-label="Add item">$1Add');
    
    // Generic fallback for any remaining Button labels
    content = content.replace(/aria-label="Button">/g, 'aria-label="Click button">');
    
    modified = true;
  }
  
  // Fix input field aria-labels
  if (content.includes('aria-label="Input field"')) {
    content = content.replace(/aria-label="Input field"/g, 'aria-label="Text input"');
    modified = true;
  }
  
  // Fix malformed onClick handlers with aria-label
  const malformedPattern = /onClick=\{?\([^)]*\)\s*=\s*aria-label=/g;
  if (malformedPattern.test(content)) {
    content = content.replace(/onClick=\{?\([^)]*\)\s*=\s*aria-label="([^"]*)"\s*>/g, 
      'onClick={() => {}} aria-label="$1">');
    modified = true;
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
  if (fixAriaLabels(file)) {
    console.log(`Fixed: ${path.relative(componentsDir, file)}`);
    fixedCount++;
  }
});

console.log(`\nFixed ARIA labels in ${fixedCount} files`);
