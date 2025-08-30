#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function fixE2EParsingErrors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Fix 1: Fix async function syntax - _async should be async
  content = content.replace(/test\('([^']+)',\s*_async\s*\(/g, (match, testName) => {
    modified = true;
    return `test('${testName}', async (`;
  });

  content = content.replace(/test\.beforeEach\(_async\s*\(/g, () => {
    modified = true;
    return 'test.beforeEach(async (';
  });

  // Fix 2: Fix destructuring with const inside test functions
  content = content.replace(/test\([^)]+\),\s*async\s*\([^)]*\)\s*=>\s*{\s*const\s+/g, (match) => {
    // Move const outside of the parameter list
    return match.replace(/\)\s*=>\s*{\s*const/, ') => {\n    const');
  });

  // Fix 3: Fix shorthand property errors - add proper variable declarations
  content = content.replace(/await authUtils\./g, 'await _authUtils.');
  content = content.replace(/await factory\./g, 'await _factory.');
  content = content.replace(/authUtils\./g, '_authUtils.');
  content = content.replace(/factory\./g, '_factory.');

  // Fix 4: Fix object literal issues - remove 'const' from inside test bodies that are misplaced
  const lines = content.split('\n');
  const fixedLines = [];
  let inTestBody = false;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Track if we're in a test body
    if (line.includes('test(') || line.includes('test.')) {
      inTestBody = true;
      braceCount = 0;
    }
    
    if (inTestBody) {
      // Count braces to track nesting
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      // Fix lines that have const in wrong places
      if (line.match(/^\s*const\s+gameSession\s*=/) && braceCount > 1) {
        // This const is fine, it's inside the test body
      } else if (line.includes('const gameSession = await factory')) {
        line = line.replace('factory', '_factory');
      }
      
      if (braceCount === 0) {
        inTestBody = false;
      }
    }
    
    fixedLines.push(line);
  }
  
  content = fixedLines.join('\n');

  // Fix 5: Fix for loops with incorrect syntax
  content = content.replace(/for\s*\(\s*let\s+i\s*=\s*0;\s*i\s*<\s*\d+;\s*i\+\+\s*\)/g, (match) => {
    return match; // Keep for loops as is, they're correct
  });

  // Fix 6: Fix variable references that should use underscore prefix
  content = content.replace(/\bfactory\.create/g, '_factory.create');
  content = content.replace(/\bauthUtils\.mock/g, '_authUtils.mock');
  content = content.replace(/\bauthUtils\.wait/g, '_authUtils.wait');
  content = content.replace(/\btestDb\.reset/g, '_testDb.reset');

  // Fix 7: Remove duplicate underscores
  content = content.replace(/__factory/g, '_factory');
  content = content.replace(/__authUtils/g, '_authUtils');
  content = content.replace(/__testDb/g, '_testDb');

  if (modified || content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed parsing errors in ${filePath}`);
    return true;
  }
  
  return false;
}

// Fix the error-handling.spec.ts file
const targetFile = path.join(__dirname, 'e2e', 'error-handling.spec.ts');
if (fs.existsSync(targetFile)) {
  fixE2EParsingErrors(targetFile);
} else {
  console.error(`File not found: ${targetFile}`);
}
