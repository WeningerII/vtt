#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all tsconfig.json files that extend the base config
const tsconfigs = execSync('find packages -name "tsconfig.json" -exec grep -l \'"extends": "../../tsconfig.base.json"\' {} \\;', {
  cwd: '/home/weningerii/vtt',
  encoding: 'utf8'
}).trim().split('\n').filter(Boolean);

console.log(`Found ${tsconfigs.length} packages extending base tsconfig`);

tsconfigs.forEach(tsconfigPath => {
  const fullPath = path.join('/home/weningerii/vtt', tsconfigPath);
  console.log(`Processing: ${tsconfigPath}`);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const config = JSON.parse(content);
    
    // Add types: [] to compilerOptions if it doesn't exist
    if (!config.compilerOptions) {
      config.compilerOptions = {};
    }
    
    if (!config.compilerOptions.types) {
      config.compilerOptions.types = [];
      
      // Write back with proper formatting
      fs.writeFileSync(fullPath, JSON.stringify(config, null, 2) + '\n');
      console.log(`  ✓ Added "types": [] to ${tsconfigPath}`);
    } else {
      console.log(`  - Already has types configuration: ${tsconfigPath}`);
    }
  } catch (error) {
    console.error(`  ✗ Error processing ${tsconfigPath}: ${error.message}`);
  }
});

console.log('TypeScript types configuration update completed');
