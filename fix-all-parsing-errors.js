#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fixParsingErrors(filePath) {
  if (!fs.existsSync(filePath)) return false;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Fix incorrect underscore usage in destructuring patterns
  // Fix: _([param]) => ([param])
  content = content.replace(/\.map\(_\(\[([^\]]+)\]\)/g, '.map([$1]');
  
  // Fix: (param) => (param) in arrow functions
  content = content.replace(/\b_\(([a-zA-Z_][a-zA-Z0-9_]*)\)\s*=>/g, '($1) =>');
  
  // Fix destructuring with misplaced underscores
  // Fix: _({prop}) => ({_prop})
  content = content.replace(/\(_\{([^}]+)\}\)/g, '({$1})');
  
  // Fix: async (param) => async (param)
  content = content.replace(/async\s+_\(/g, 'async (');
  
  // Fix misplaced underscores in function parameters
  // Fix: function(_param: type) => function(_param: type)
  content = content.replace(/function\s*\(_([a-zA-Z])/g, 'function(_$1');
  
  // Fix underscore before string literals
  // Fix: 'string' => 'string'
  content = content.replace(/_(['"`])/g, '$1');
  
  // Fix underscore in new expressions
  // Fix: new (Something) => new Something
  content = content.replace(/new\s+_\(/g, 'new (');
  
  // Fix multiple underscores in parameters
  // Fix: (_a, _b) => (_a, _b) [ensure proper formatting]
  content = content.replace(/\(\s*_([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*_([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g, '(_$1, _$2)');
  
  // Fix underscore before JSX elements
  // Fix: <Component => <Component
  content = content.replace(/</g, '<');
  
  // Fix underscore in event handlers
  // Fix: on('event' => on('event'
  content = content.replace(/on_\(/g, 'on(');
  
  // Fix React.FC declarations with underscores
  // Fix: React.FC<{prop}> => React.FC<{prop}>
  content = content.replace(/React\.FC<_\{/g, 'React.FC<{');
  
  // Fix async syntax issues
  content = content.replace(/,\s*_async\s*\(/g, ', async (');
  content = content.replace(/\b_async\s*\(/g, 'async (');
  
  // Fix misplaced const in destructuring
  // Fix issues like: const in middle of destructuring
  content = content.replace(/,\s*const\s+([a-zA-Z_])/g, ', $1');
  
  // Fix shorthand property syntax errors
  // Fix: {property} => {property}
  content = content.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\}/g, '{$1}');
  
  // Fix trailing commas in function parameters
  content = content.replace(/,\s*\)/g, ')');
  
  // Fix double commas
  content = content.replace(/,\s*,/g, ',');
  
  // Fix specific pattern in map functions with destructuring
  // Fix: .map([a, _b] => .map(([a, b])
  content = content.replace(/\.map\s*\(\s*_\(\s*\[([^\]]+)\]\s*\)/g, '.map(([$$1])');
  
  // Fix underscore in destructuring with type annotations
  // Fix: _(param: Type) => (_param: Type)
  content = content.replace(/\(_([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([^)]+)\)/g, '(_$1: $2)');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }
  
  return false;
}

function findTypeScriptFiles(dir) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip directories we don't want to process
      if (item === 'node_modules' || item === 'dist' || item === 'coverage' || 
          item === '.pnpm-store' || item === 'playwright-report' || item === 'test-results' ||
          item === '.git' || item === 'build') {
        continue;
      }
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || 
                 fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

console.log('Scanning for TypeScript and JavaScript files...');
const files = findTypeScriptFiles(process.cwd());
console.log(`Found ${files.length} files to check`);

let fixedCount = 0;
for (const file of files) {
  if (fixParsingErrors(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);

// Run ESLint to check remaining issues
console.log('\nChecking remaining ESLint issues...');
try {
  const output = execSync('npx eslint . --ext .js,.jsx,.ts,.tsx --format compact 2>&1 | grep -c "error"', { encoding: 'utf8' });
  console.log(`Remaining errors: ${output.trim()}`);
} catch (e) {
  console.log('ESLint check completed');
}
