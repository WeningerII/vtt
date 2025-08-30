#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '../packages');

// Template for package README
const generateReadme = (packageName, description) => `# @vtt/${packageName}

${description}

## Installation

\`\`\`bash
npm install @vtt/${packageName}
\`\`\`

## Usage

\`\`\`typescript
import { /* modules */ } from '@vtt/${packageName}';
\`\`\`

## API Reference

### Core Modules

See the source code for detailed API documentation.

## Features

- Type-safe TypeScript implementation
- Modular architecture
- Comprehensive error handling
- Performance optimized

## Development

\`\`\`bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Watch mode
npm run dev
\`\`\`

## License

MIT
`;

// Package descriptions
const packageDescriptions = {
  'asset-pipeline': 'Asset processing and optimization pipeline for VTT resources',
  'audio': 'Audio management system for sound effects and ambient music',
  'class-features': 'D&D 5e class features and abilities management',
  'collaboration': 'Real-time collaboration features for multiplayer sessions',
  'concentration-manager': 'Spell concentration tracking and management',
  'conditions-engine': 'Status effects and conditions system',
  'config': 'Configuration management and environment settings',
  'content': 'Content management system for game assets',
  'content-5e-srd': 'D&D 5e System Reference Document content',
  'content-creation': 'Tools for creating custom game content',
  'content-management': 'Content organization and storage system',
  'content-yjs': 'Yjs-based collaborative content editing',
  'core-ecs': 'Entity Component System architecture',
  'core-schemas': 'Core data schemas and type definitions',
  'dice-roller': 'Advanced dice rolling engine with modifiers',
  'dm-tools': 'Dungeon Master tools and utilities',
  'encounter-builder': 'Encounter creation and balancing tools',
  'game-session': 'Game session management and state handling',
  'grid': 'Grid-based map system and pathfinding',
  'initiative-tracker': 'Combat initiative tracking system',
  'item-management': 'Inventory and item management system',
  'lighting': 'Dynamic lighting and vision system',
  'logging': 'Structured logging with Pino and OpenTelemetry',
  'map-editor': 'Interactive map editing tools',
  'map-tools': 'Map manipulation and analysis utilities',
  'monster-abilities': 'Monster abilities and actions system',
  'monitoring': 'Application monitoring and telemetry',
  'npc-generator': 'Non-player character generation tools',
  'party-management': 'Party organization and management',
  'pathfinding': 'A* pathfinding algorithm implementation',
  'physics': 'Physics simulation for projectiles and effects',
  'physics-spell-bridge': 'Bridge between physics and spell systems',
  'player-management': 'Player account and character management',
  'renderer': 'WebGL/Canvas rendering engine',
  'rules-engine': 'D&D 5e rules implementation',
  'scene-management': 'Scene organization and transitions',
  'security': 'Security utilities and authentication helpers',
  'session-recording': 'Game session recording and playback',
  'shared': 'Shared utilities and common code',
  'spell-effects': 'Visual and mechanical spell effects',
  'spell-engine': 'Spell casting and resolution system',
  'state-management': 'Global state management with Zustand',
  'token-management': 'Token creation and management on maps',
  'ui': 'Shared UI components and utilities',
  'user-management': 'User account and profile management',
  'utils': 'Common utility functions and helpers',
  'validation': 'Data validation and sanitization',
  'vtt-core': 'Core VTT functionality and systems',
  'websocket': 'WebSocket communication layer'
};

// Get all packages
const packages = fs.readdirSync(packagesDir).filter(dir => {
  const fullPath = path.join(packagesDir, dir);
  return fs.statSync(fullPath).isDirectory();
});

let created = 0;
let skipped = 0;

packages.forEach(packageName => {
  const readmePath = path.join(packagesDir, packageName, 'README.md');
  
  if (fs.existsSync(readmePath)) {
    console.log(`✓ ${packageName} already has README`);
    skipped++;
  } else {
    const description = packageDescriptions[packageName] || 
      `${packageName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} module for the VTT platform`;
    
    const content = generateReadme(packageName, description);
    fs.writeFileSync(readmePath, content);
    console.log(`✅ Created README for ${packageName}`);
    created++;
  }
});

console.log(`\n📊 Documentation Summary:`);
console.log(`✅ Created: ${created} README files`);
console.log(`⏭️  Skipped: ${skipped} (already exist)`);
console.log(`📁 Total packages: ${packages.length}`);
