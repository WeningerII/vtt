#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync  } from 'child_process';

// Get ESLint report with all violations
console.log('Analyzing ESLint violations...');
const eslintOutput = execSync('npx eslint . --ext .ts,.tsx --format json', {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
  cwd: __dirname
}).trim();

const results = JSON.parse(eslintOutput);
let totalFixed = 0;
const fixedFiles = new Set();

// Process each file with violations
for (const file of results) {
  if (!file.messages || file.messages.length === 0) continue;
  
  const filePath = file.filePath;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let lines = content.split('\n');
    
    // Sort messages by line number in reverse to avoid offset issues
    const messages = file.messages.sort((a, b) => b.line - a.line);
    
    for (const msg of messages) {
      const lineNum = msg.line - 1;
      if (lineNum < 0 || lineNum >= lines.length) continue;
      
      let line = lines[lineNum];
      let originalLine = line;
      
      // Fix parsing errors with destructuring
      if (msg.message && msg.message.includes("Parsing error: ',' expected")) {
        // Fix destructuring with underscore: ({_prop1, _prop2, ...})
        const destructMatch = line.match(/\(({_[^}]+})\)/);
        if (destructMatch) {
          const props = destructMatch[1];
          // Ensure all props in destructuring have underscores properly placed
          const fixed = props.replace(/{_([^,}]+)/g, '{_$1')
            .replace(/,\s*_([^,}]+)/g, ', _$1')
            .replace(/_([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '_$1:');
          line = line.replace(destructMatch[0], '(' + fixed + ')');
        }
        
        // Fix array destructuring
        const arrayMatch = line.match(/\[_([^\]]+)\]/);
        if (arrayMatch) {
          line = line.replace(/\[_([^\]]+)\]/g, '[_$1]');
        }
      }
      
      // Fix parsing errors with parentheses
      if (msg.message && msg.message.includes("Parsing error: ')' expected")) {
        // Fix function parameters with underscore
        line = line.replace(/\(({_[^}]+})\s*([)])/g, '({_$1}$2');
        // Fix misplaced underscores in params
        line = line.replace(/\(\s*{_([^}]+)}\s*\)/g, '({_$1})');
      }
      
      // Fix unused variables
      if (msg.ruleId === '@typescript-eslint/no-unused-vars') {
        const match = msg.message.match(/'([^']+)' is .* but never used/);
        if (match && match[1]) {
          const varName = match[1];
          // Only add underscore if not already present
          if (!varName.startsWith('')) {
            // Different patterns for different contexts
            // Function parameters
            line = line.replace(new RegExp(`\\(([^)]*\\b)${varName}(\\b[^)]*)\\)`, 'g'), `($1_${varName}$2)`);
            // Variable declarations
            line = line.replace(new RegExp(`\\b(const|let|var|function)\\s+${varName}\\b`, 'g'), `$1 _${varName}`);
            // Object destructuring
            line = line.replace(new RegExp(`{([^}]*\\b)${varName}(\\b[^}]*)}`, 'g'), `{$1_${varName}$2}`);
            // Type annotations
            line = line.replace(new RegExp(`\\b${varName}\\s*:`, 'g'), `_${varName}:`);
          }
        }
      }
      
      // Fix empty object types
      if (msg.ruleId === '@typescript-eslint/no-empty-object-type' || 
          (msg.message && msg.message.includes('empty object'))) {
        line = line.replace(/:\s*\{\s*\}(?![\w])/g, ': Record<string, any>');
        line = line.replace(/interface\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{\s*\}/g, 'interface $1 { [key: string]: any }');
        line = line.replace(/type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\{\s*\}/g, 'type $1 = Record<string, any>');
      }
      
      // Fix Function types
      if (msg.ruleId === '@typescript-eslint/no-unsafe-function-type' ||
          (msg.message && msg.message.includes('Function'))) {
        line = line.replace(/:\s*Function(?![a-zA-Z])/g, ': (...args: any[]) => any');
        line = line.replace(/Array<Function>/g, 'Array<(...args: any[]) => any>');
      }
      
      // Fix require imports
      if (msg.ruleId === '@typescript-eslint/no-require-imports') {
        const requireMatch = line.match(/const\s+({[^}]+}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          const [, varPart, moduleName] = requireMatch;
          // Handle destructuring and regular imports
          if (varPart.startsWith('{')) {
            line = `import ${varPart} from '${moduleName}';`;
          } else {
            line = `import * as ${varPart} from '${moduleName}';`;
          }
        }
      }
      
      // Fix no-useless-escape
      if (msg.ruleId === 'no-useless-escape') {
        line = line.replace(/\\([^\\'"bfnrtv0xu\n\r])/g, '$1');
      }
      
      if (line !== originalLine) {
        lines[lineNum] = line;
      }
    }
    
    content = lines.join('\n');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedFiles.add(filePath);
      totalFixed++;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

console.log(`\nFixed ${totalFixed} files`);

// Check remaining issues
console.log('\nChecking remaining ESLint issues...');
try {
  const result = execSync('npx eslint . --ext .ts,.tsx 2>&1', { encoding: 'utf8' });
  console.log('✅ No ESLint errors found!');
} catch (error) {
  const output = error.stdout || error.message;
  const lines = output.split('\n');
  const errorCount = lines.find(l => l.includes('problem'));
  if (errorCount) {
    console.log(errorCount);
    
    // Show summary of remaining issues
    console.log('\nRemaining issue types:');
    const ruleViolations = {};
    const remainingResults = JSON.parse(execSync('npx eslint . --ext .ts,.tsx --format json', {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    }).trim());
    
    for (const file of remainingResults) {
      if (file.messages) {
        for (const msg of file.messages) {
          const key = msg.ruleId || msg.message.split(':')[0];
          ruleViolations[key] = (ruleViolations[key] || 0) + 1;
        }
      }
    }
    
    const sorted = Object.entries(ruleViolations).sort((a, b) => b[1] - a[1]);
    for (const [rule, count] of sorted.slice(0, 10)) {
      console.log(`  ${count} - ${rule}`);
    }
  }
}
