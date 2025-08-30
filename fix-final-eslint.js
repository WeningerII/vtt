#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync  } from 'child_process';

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Fix parsing errors with async syntax
  content = content.replace(/,\s*_async\s*\(/g, ', async (');
  content = content.replace(/\b_async\s*\(/g, 'async (');
  
  // Fix destructuring with underscores
  content = content.replace(/\(_{([^}]+)}\)/g, '({_$1})');
  content = content.replace(/\(_([a-zA-Z]+),/g, '(_$1,');
  
  // Fix unused variables - prefix with underscore
  content = content.replace(/\bconst\s+([a-zA-Z][a-zA-Z0-9]*)\s*=\s*([^;]+);\s*\/\/\s*unused/gi, 'const _$1 = $2;');
  
  // Fix React hooks deps
  content = content.replace(/\/\/\s*eslint-disable-next-line\s+react-hooks\/exhaustive-deps/g, '');
  
  // Add underscore to unused parameters in arrow functions
  content = content.replace(/\(([a-zA-Z][a-zA-Z0-9]*)\)\s*=>\s*{/g, (match, param) => {
    // Check if parameter is used in the function body
    const funcBodyMatch = content.substring(content.indexOf(match)).match(/=>\s*{([^}]*)}/);
    if (funcBodyMatch && !funcBodyMatch[1].includes(param)) {
      return `(_${param}) => {`;
    }
    return match;
  });

  // Fix empty object types
  content = content.replace(/:\s*{}\s*([,;)\]}])/g, ': Record<string, unknown>$1');
  
  // Fix Function types
  content = content.replace(/:\s*Function\b/g, ': (...args: unknown[]) => unknown');
  
  // Fix require imports
  content = content.replace(/const\s+{\s*([^}]+)\s*}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, 
    "import { $1 } from '$2'");
  content = content.replace(/const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, 
    "import $1 from '$2'");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }
  
  return false;
}

function findFiles(dir, extensions) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip node_modules, dist, coverage, etc.
      if (item === 'node_modules' || item === 'dist' || item === 'coverage' || 
          item === '.pnpm-store' || item === 'playwright-report' || item === 'test-results') {
        continue;
      }
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (extensions.some(ext => fullPath.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// Find all TypeScript and JavaScript files
const files = findFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx']);

console.log(`Found ${files.length} files to check...`);

let fixedCount = 0;
for (const file of files) {
  if (fixFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);

// Run ESLint with autofix
console.log('\nRunning ESLint autofix...');
try {
  execSync('npx eslint . --ext .js,.jsx,.ts,.tsx --fix --quiet', { stdio: 'inherit' });
} catch (e) {
  // ESLint returns non-zero exit code if there are unfixed issues
  console.log('ESLint autofix completed (some issues may remain)');
}

// Get final count
console.log('\nGetting final ESLint report...');
try {
  const output = execSync('npx eslint . --ext .js,.jsx,.ts,.tsx --format compact 2>&1 | grep -E "Error|Warning" | wc -l', { encoding: 'utf8' });
  console.log(`Remaining issues: ${output.trim()}`);
} catch (e) {
  console.log('Could not get final count');
}
