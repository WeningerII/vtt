#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix missing React imports
function fixReactImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file uses React without importing it
  if (content.includes('React.') && !content.includes('import React') && !content.includes('import * as React')) {
    // Add React import at the beginning
    content = `import React from 'react';\n` + content;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed React import in ${filePath}`);
  }
}

// Fix rest import for msw
function fixMswImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  if (content.includes('rest.') && !content.includes('import { rest }') && !content.includes('from "msw"')) {
    // Add msw import
    content = `import { rest } from 'msw';\n` + content;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed MSW import in ${filePath}`);
  }
}

// Fix useRef calls without initial value
function fixUseRef(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix useRef<Type>() to useRef<Type>(null)
  content = content.replace(/useRef<([^>]+)>\(\)/g, 'useRef<$1>(null)');
  
  if (content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed useRef in ${filePath}`);
  }
}

// Fix cacheTime to gcTime for React Query v5
function fixReactQuery(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace cacheTime with gcTime
  if (content.includes('cacheTime:')) {
    content = content.replace(/cacheTime:/g, 'gcTime:');
    fs.writeFileSync(filePath, content);
    console.log(`Fixed React Query cacheTime in ${filePath}`);
  }
}

// Process files
const files = [
  'src/components/dashboard/DashboardLayout.tsx',
  'src/hooks/custom.ts',
  'src/security/csp.ts',
  'src/security/csrf.ts',
  'src/security/inputSanitization.ts',
  'src/test-utils/msw-handlers.ts',
  'src/test-utils/test-utils.tsx',
  'src/utils/performance.ts'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    fixReactImports(filePath);
    fixMswImports(filePath);
    fixUseRef(filePath);
    fixReactQuery(filePath);
  }
});

console.log('TypeScript error fixes applied');
