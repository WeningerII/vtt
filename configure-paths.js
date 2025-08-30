#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Configures TypeScript paths and module resolution
 * to enable proper imports across the monorepo
 */

console.log('🔧 Configuring TypeScript paths...\n');

// Update base tsconfig.json with path mappings
const baseTsConfigPath = '/home/weningerii/vtt/tsconfig.base.json';
let baseTsConfig = {};

if (fs.existsSync(baseTsConfigPath)) {
  baseTsConfig = JSON.parse(fs.readFileSync(baseTsConfigPath, 'utf8'));
}

// Configure comprehensive path mappings
baseTsConfig.compilerOptions = {
  ...baseTsConfig.compilerOptions,
  baseUrl: '.',
  paths: {
    // UI package
    '@vtt/ui': ['packages/ui/src/index.ts'],
    '@vtt/ui/*': ['packages/ui/src/*'],
    
    // Apps
    '@/client/*': ['apps/client/src/*'],
    '@/editor/*': ['apps/editor/src/*'],
    '@/server/*': ['apps/server/src/*'],
    
    // Individual packages
    '@vtt/ai': ['packages/ai/src/index.ts'],
    '@vtt/ai/*': ['packages/ai/src/*'],
    '@vtt/analytics': ['packages/analytics/src/index.ts'],
    '@vtt/analytics/*': ['packages/analytics/src/*'],
    '@vtt/asset-pipeline': ['packages/asset-pipeline/src/index.ts'],
    '@vtt/asset-pipeline/*': ['packages/asset-pipeline/src/*'],
    '@vtt/audio': ['packages/audio/src/index.ts'],
    '@vtt/audio/*': ['packages/audio/src/*'],
    '@vtt/auth': ['packages/auth/src/index.ts'],
    '@vtt/auth/*': ['packages/auth/src/*'],
    '@vtt/character-management': ['packages/character-management/src/index.ts'],
    '@vtt/character-management/*': ['packages/character-management/src/*'],
    '@vtt/collaboration': ['packages/collaboration/src/index.ts'],
    '@vtt/collaboration/*': ['packages/collaboration/src/*'],
    '@vtt/conditions-engine': ['packages/conditions-engine/src/index.ts'],
    '@vtt/conditions-engine/*': ['packages/conditions-engine/src/*'],
    '@vtt/content': ['packages/content/src/index.ts'],
    '@vtt/content/*': ['packages/content/src/*'],
    '@vtt/content-5e-srd': ['packages/content-5e-srd/src/index.ts'],
    '@vtt/content-5e-srd/*': ['packages/content-5e-srd/src/*'],
    '@vtt/content-yjs': ['packages/content-yjs/src/index.ts'],
    '@vtt/content-yjs/*': ['packages/content-yjs/src/*'],
    '@vtt/core': ['packages/core/src/index.ts'],
    '@vtt/core/*': ['packages/core/src/*'],
    '@vtt/core-ecs': ['packages/core-ecs/src/index.ts'],
    '@vtt/core-ecs/*': ['packages/core-ecs/src/*'],
    '@vtt/core-schemas': ['packages/core-schemas/src/index.ts'],
    '@vtt/core-schemas/*': ['packages/core-schemas/src/*'],
    '@vtt/data-layer': ['packages/data-layer/src/index.ts'],
    '@vtt/data-layer/*': ['packages/data-layer/src/*'],
    '@vtt/dice-engine': ['packages/dice-engine/src/index.ts'],
    '@vtt/dice-engine/*': ['packages/dice-engine/src/*'],
    '@vtt/map-editor': ['packages/map-editor/src/index.ts'],
    '@vtt/map-editor/*': ['packages/map-editor/src/*'],
    '@vtt/monitoring': ['packages/monitoring/src/index.ts'],
    '@vtt/monitoring/*': ['packages/monitoring/src/*'],
    '@vtt/net': ['packages/net/src/index.ts'],
    '@vtt/net/*': ['packages/net/src/*'],
    '@vtt/notification': ['packages/notification/src/index.ts'],
    '@vtt/notification/*': ['packages/notification/src/*'],
    '@vtt/performance': ['packages/performance/src/index.ts'],
    '@vtt/performance/*': ['packages/performance/src/*'],
    '@vtt/physics': ['packages/physics/src/index.ts'],
    '@vtt/physics/*': ['packages/physics/src/*'],
    '@vtt/physics-spell-bridge': ['packages/physics-spell-bridge/src/index.ts'],
    '@vtt/physics-spell-bridge/*': ['packages/physics-spell-bridge/src/*'],
    '@vtt/platform': ['packages/platform/src/index.ts'],
    '@vtt/platform/*': ['packages/platform/src/*'],
    '@vtt/plugin-system': ['packages/plugin-system/src/index.ts'],
    '@vtt/plugin-system/*': ['packages/plugin-system/src/*'],
    '@vtt/renderer': ['packages/renderer/src/index.ts'],
    '@vtt/renderer/*': ['packages/renderer/src/*'],
    '@vtt/rules-5e': ['packages/rules-5e/src/index.ts'],
    '@vtt/rules-5e/*': ['packages/rules-5e/src/*'],
    '@vtt/security': ['packages/security/src/index.ts'],
    '@vtt/security/*': ['packages/security/src/*'],
    '@vtt/spell-engine': ['packages/spell-engine/src/index.ts'],
    '@vtt/spell-engine/*': ['packages/spell-engine/src/*'],
    '@vtt/testing': ['packages/testing/src/index.ts'],
    '@vtt/testing/*': ['packages/testing/src/*'],
    '@vtt/user-management': ['packages/user-management/src/index.ts'],
    '@vtt/user-management/*': ['packages/user-management/src/*'],
    
    // Services
    '@services/auth': ['services/auth/src/index.ts'],
    '@services/auth/*': ['services/auth/src/*'],
    '@services/files': ['services/files/src/index.ts'],
    '@services/files/*': ['services/files/src/*']
  },
  
  // Other important compiler options
  moduleResolution: 'node',
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  strict: true,
  strictNullChecks: true,
  noUnusedLocals: false, // Temporarily disabled during migration
  noUnusedParameters: false, // Temporarily disabled during migration
  noImplicitAny: false, // Temporarily disabled during migration
  
  // Type roots
  typeRoots: [
    './node_modules/@types',
    './types'
  ],
  
  // Libraries
  lib: ['ES2020', 'DOM', 'DOM.Iterable']
};

// Write updated base tsconfig
fs.writeFileSync(baseTsConfigPath, JSON.stringify(baseTsConfig, null, 2));
console.log('✅ Updated tsconfig.base.json with path mappings');

// Update individual app tsconfigs to extend base
const appTsConfigs = [
  {
    path: '/home/weningerii/vtt/apps/client/tsconfig.json',
    name: 'client'
  },
  {
    path: '/home/weningerii/vtt/apps/editor/tsconfig.json',
    name: 'editor'
  },
  {
    path: '/home/weningerii/vtt/apps/server/tsconfig.json',
    name: 'server'
  }
];

appTsConfigs.forEach(({ path: configPath, name }) => {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Ensure it extends the base config
    config.extends = '../../tsconfig.base.json';
    
    // Add any app-specific overrides
    config.compilerOptions = {
      ...config.compilerOptions,
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
        ...baseTsConfig.compilerOptions.paths
      }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ Updated apps/${name}/tsconfig.json`);
  }
});

// Update pnpm-workspace.yaml to include UI package
const workspacePath = '/home/weningerii/vtt/pnpm-workspace.yaml';
let workspaceContent = fs.readFileSync(workspacePath, 'utf8');

if (!workspaceContent.includes('packages/ui')) {
  // Parse and update workspace
  const lines = workspaceContent.split('\n');
  const packagesIndex = lines.findIndex(line => line.includes('packages:'));
  
  if (packagesIndex !== -1) {
    // Find where to insert
    let insertIndex = packagesIndex + 1;
    while (insertIndex < lines.length && lines[insertIndex].startsWith('  -')) {
      if (lines[insertIndex].includes('packages/')) {
        break;
      }
      insertIndex++;
    }
    
    // Insert the ui package
    lines.splice(insertIndex, 0, '  - packages/ui');
    
    fs.writeFileSync(workspacePath, lines.join('\n'));
    console.log('✅ Added packages/ui to pnpm-workspace.yaml');
  }
}

// Create type definition file for global types
const globalTypesContent = `// Global type definitions for VTT project

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.wgsl' {
  const content: string;
  export default content;
}

// WebGPU types (if not using @webgpu/types)
interface GPUCanvasContext {
  configure(configuration: GPUCanvasConfiguration): void;
  unconfigure(): void;
  getCurrentTexture(): GPUTexture;
}

// Extend Window for any custom properties
interface Window {
  vtt?: {
    version: string;
    debug: boolean;
  };
}

// Common VTT types
type UUID = string;
type EntityID = string;
type Timestamp = number;

interface Position {
  x: number;
  y: number;
  z?: number;
}

interface Dimensions {
  width: number;
  height: number;
  depth?: number;
}

interface Transform {
  position: Position;
  rotation?: number;
  scale?: number;
}
`;

// Create types directory and global.d.ts
const typesDir = '/home/weningerii/vtt/types';
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir);
}

fs.writeFileSync(path.join(typesDir, 'global.d.ts'), globalTypesContent);
console.log('✅ Created types/global.d.ts');

console.log('\n✅ TypeScript path configuration complete!');
console.log('\n📝 Next steps:');
console.log('1. Run: pnpm install');
console.log('2. Test imports with: pnpm typecheck');
console.log('3. Start using absolute imports like:');
console.log('   - import { cn } from "@vtt/ui"');
console.log('   - import { useAuth } from "@/client/hooks/custom"');
console.log('   - import { GameEngine } from "@vtt/core"');
