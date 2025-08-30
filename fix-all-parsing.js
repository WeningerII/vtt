#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import glob from 'glob';

// Find all TypeScript and JSX files
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
    
    // Fix all patterns with underscore before parentheses for unused params
    // Pattern 1: functionCall((_param) => should be functionCall((_param) =>
    content = content.replace(/\(\s*_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, '((_$1) =>');
    
    // Pattern 2: new Class((_param) => should be new Class((_param) =>
    content = content.replace(/(new\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\()\s*_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, '$1(_$2) =>');
    
    // Pattern 3: = (_param) => should be = (_param) =>
    content = content.replace(/=\s*_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, '= (_$1) =>');
    
    // Pattern 4: observer((_param) => should be observer((_param) =>
    content = content.replace(/([A-Za-z_$][A-Za-z0-9_$]*)\(\s*_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, '$1((_$2) =>');
    
    // Pattern 5: More complex patterns with typed params
    // Pattern: (_param: type) => should be (_param: type) =>
    content = content.replace(/\b_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([^)]+)\)\s*=>/g, '(_$1: $2) =>');
    
    // Pattern 6: Multiple params where one has underscore
    // e.g., (param1, _param2) => should be (param1, _param2) =>
    content = content.replace(/,\s*_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)/g, ', _$1');
    
    // Pattern 7: Destructuring with underscore
    // _{prop} or _[index] patterns
    content = content.replace(/\b_\{([^}]+)\}/g, '_{$1}');
    content = content.replace(/\b_\[([^\]]+)\]/g, '_[$1]');
    
    // Pattern 8: Fix callback patterns in method calls
    // .method((_x) => should be .method((_x) =>
    content = content.replace(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)\(\s*_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, '.$1((_$2) =>');
    
    // Pattern 9: Fix async patterns
    // async (_param) => should be async (_param) =>
    content = content.replace(/async\s+_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, 'async (_$1) =>');
    
    // Pattern 10: Fix multiple underscored params
    // (_param1, _param2) => should be (_param1, _param2) =>
    content = content.replace(/\b_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, '(_$1, _$2) =>');
    
    // Pattern 11: Fix three params
    content = content.replace(/\b_\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\)\s*=>/g, '(_$1, _$2, _$3) =>');
    
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
