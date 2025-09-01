#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function processFile(filePath, fixes) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  fixes.forEach(fix => {
    content = fix(content);
  });
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  }
}

// Fix React imports
const fixReactImport = (content) => {
  if (content.includes('React.') && !content.includes('import React') && !content.includes('import * as React')) {
    return `import React from 'react';\n` + content;
  }
  return content;
};

// Fix MSW imports
const fixMswImport = (content) => {
  if (content.includes('rest.') && !content.includes('import { rest }') && !content.includes('from "msw"')) {
    return `import { rest } from 'msw';\n` + content;
  }
  return content;
};

// Fix useRef without initial value
const fixUseRef = (content) => {
  return content.replace(/useRef<([^>]+)>\(\)/g, 'useRef<$1>(null)');
};

// Fix React Query v5 changes
const fixReactQuery = (content) => {
  return content
    .replace(/cacheTime:/g, 'gcTime:')
    .replace(/query\.state\.status === "loading"/g, 'query.state.status === "pending"');
};

// Fix optional chaining for possibly undefined
const fixOptionalChaining = (content) => {
  // Fix contentType.toLowerCase() to contentType?.toLowerCase()
  return content.replace(/const normalizedType = contentType\.toLowerCase\(\)/g, 
    'const normalizedType = contentType?.toLowerCase()');
};

// Fix spread operator issues
const fixSpreadOperator = (content) => {
  // Ensure body is typed correctly in MSW handlers
  if (content.includes('...body,') && content.includes('msw')) {
    content = content.replace(/const body = await req\.json\(\);/g, 
      'const body = await req.json() as Record<string, any>;');
  }
  return content;
};

// Fix missing type assertions
const fixTypeAssertions = (content) => {
  // Fix body destructuring in MSW
  if (content.includes('const { query, context } = body;')) {
    content = content.replace('const { query, context } = body;',
      'const { query, context } = body as { query: string; context?: any };');
  }
  return content;
};

// Fix exactOptionalPropertyTypes issues
const fixOptionalProps = (content) => {
  // Fix queryClient prop type
  if (content.includes('queryClient: QueryClient | undefined;')) {
    content = content.replace('queryClient: QueryClient | undefined;', 
      'queryClient?: QueryClient;');
  }
  return content;
};

// Files to process
const filesToFix = {
  'src/components/dashboard/DashboardLayout.tsx': [fixReactImport],
  'src/hooks/custom.ts': [fixReactImport],
  'src/security/csp.ts': [fixReactImport],
  'src/security/csrf.ts': [fixReactImport],
  'src/security/inputSanitization.ts': [fixReactImport],
  'src/security/utils.ts': [fixOptionalChaining],
  'src/test-utils/msw-handlers.ts': [fixMswImport, fixSpreadOperator, fixTypeAssertions],
  'src/test-utils/test-utils.tsx': [fixReactQuery, fixOptionalProps],
  'src/utils/performance.ts': [fixUseRef]
};

// Process all files
Object.entries(filesToFix).forEach(([file, fixes]) => {
  const filePath = path.join(__dirname, file);
  processFile(filePath, fixes);
});

// Fix test files that import from test-utils
const testFiles = [
  'src/components/CombatTracker.test.tsx',
  'src/components/CombatTrackerIntegrated.test.tsx',
  'src/components/GameCanvas.test.tsx',
  'src/components/GameLobby.test.tsx',
  'src/components/VTTApp.test.tsx'
];

testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Update import to use correct test-utils
    content = content.replace(/from ['"]\.\.\/test-utils['"];?/g, 'from "../test-utils/test-utils";');
    fs.writeFileSync(filePath, content);
    console.log(`Fixed test import in ${file}`);
  }
});

console.log('All TypeScript fixes applied');
