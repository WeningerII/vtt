#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix MSW handlers syntax errors
function fixMswHandlers() {
  const filePath = path.join(__dirname, 'src/test-utils/msw-handlers.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix incorrect return statements with multiple HttpResponse calls
  // These should be single returns with status codes
  content = content.replace(
    /return HttpResponse\.json\(400\), HttpResponse\.json\({ error: "Invalid dice expression" }\)\);/g,
    'return HttpResponse.json({ error: "Invalid dice expression" }, { status: 400 });'
  );
  
  content = content.replace(
    /return HttpResponse\.json\(500\), HttpResponse\.json\({ error: "Simulated server error" }\)\);/g,
    'return HttpResponse.json({ error: "Simulated server error" }, { status: 500 });'
  );
  
  // Fix any other similar patterns
  content = content.replace(
    /return HttpResponse\.json\((\d+)\), HttpResponse\.json\((.*?)\)\);/g,
    'return HttpResponse.json($2, { status: $1 });'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed MSW handlers syntax errors');
}

// Fix test-utils syntax errors
function fixTestUtils() {
  const filePath = path.join(__dirname, 'src/test-utils/test-utils.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find and fix the QueryClient initialization with broken syntax
  // Look for the pattern where logger was removed but left broken syntax
  content = content.replace(
    /new QueryClient\({[\s\S]*?\n\s*}\);/g,
    (match) => {
      // Clean up the QueryClient config
      let cleaned = match;
      // Remove any trailing commas before closing braces
      cleaned = cleaned.replace(/,(\s*})/g, '$1');
      // Remove empty object literals
      cleaned = cleaned.replace(/{\s*,/g, '{');
      // Fix any double commas
      cleaned = cleaned.replace(/,,/g, ',');
      return cleaned;
    }
  );
  
  // Specifically fix the common pattern where logger was removed
  content = content.replace(
    /defaultOptions: {\s*queries: {[^}]*}\s*,?\s*}/g,
    `defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false
      }
    }`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed test-utils syntax errors');
}

// Run fixes
console.log('Fixing syntax errors...\n');

fixMswHandlers();
fixTestUtils();

console.log('\nSyntax errors fixed!');
