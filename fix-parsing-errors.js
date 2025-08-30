#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import glob from 'glob';

// Find all TypeScript and JavaScript files
const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
  ignore: ['node_modules/**', 'dist/**', 'build/**', '.pnpm-store/**', 'coverage/**'],
  absolute: true
});

console.log(`Processing ${files.length} files...`);

let fixedCount = 0;

for (const filePath of files) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Fix misplaced underscores from previous automated fixes
    
    // Pattern 1: 'string' or "string" or `string` -> 'string', "string", `string`
    content = content.replace(/_(['"`])/g, '$1');
    
    // Pattern 2: (_param: type) => should be (_param: type) =>
    content = content.replace(/\b_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '(_$1:');
    
    // Pattern 3: () => should be ()
    content = content.replace(/\b_\(\)/g, '()');
    
    // Pattern 4: <Component or <div etc -> <Component, <div
    content = content.replace(/</g, '<');
    
    // Pattern 5: .on('event' -> .on('event'
    content = content.replace(/\(_(['"`])/g, '($1');
    
    // Pattern 6: ws.on('open', () -> ws.on('open', ()
    // This is a more complex pattern that combines previous ones
    content = content.replace(/\.on\(_(['"`][^'"`)]+['"`]),\s*_\(/g, '.on($1, (');
    
    // Pattern 7: Fix arrow functions with underscore before parentheses
    content = content.replace(/=>\s*_\(/g, '=> (');
    content = content.replace(/,\s*_\(/g, ', (');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedCount++;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

console.log(`\nFixed ${fixedCount} files`);

// Run ESLint to check remaining issues
console.log('\nChecking remaining ESLint issues...');
import { execSync  } from 'child_process';
try {
  const result = execSync('npx eslint . --ext .ts,.tsx 2>&1', { encoding: 'utf8' });
  console.log('No ESLint errors found!');
} catch (error) {
  const output = error.stdout || error.message;
  const lines = output.split('\n');
  const errorCount = lines.find(l => l.includes('problem'));
  if (errorCount) {
    console.log(errorCount);
  }
}
