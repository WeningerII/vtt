#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix tsconfig.json to handle rootDir issue
function fixTsConfig() {
  const tsconfigPath = path.join(__dirname, 'tsconfig.json');
  let content = fs.readFileSync(tsconfigPath, 'utf8');
  
  // Remove rootDir to allow files outside src
  content = content.replace(/"rootDir": ".*",/, '');
  
  // Ensure resolveJsonModule is set
  if (!content.includes('resolveJsonModule')) {
    content = content.replace(
      /"jsx": "react-jsx",/,
      `"jsx": "react-jsx",
    "resolveJsonModule": true,`
    );
  }
  
  fs.writeFileSync(tsconfigPath, content);
  console.log('Fixed tsconfig.json');
}

// Fix MSW handlers for v2 syntax
function fixMswHandlers() {
  const filePath = path.join(__dirname, 'src/test-utils/msw-handlers.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove duplicate imports
  content = content.replace(/import { http, HttpResponse } from 'msw';\nimport { http, HttpResponse } from "msw";/, 
    'import { http, HttpResponse } from "msw";');
  
  // Fix handler signatures for MSW v2
  content = content.replace(/async \(req, res, ctx\) => {/g, 'async ({ request }) => {');
  content = content.replace(/\(req, res, ctx\) => {/g, '({ request }) => {');
  
  // Fix request body access
  content = content.replace(/const body = await req\.json\(\);/g, 'const body = await request.json();');
  content = content.replace(/req\.url\.searchParams/g, 'new URL(request.url).searchParams');
  
  // Fix spread operator issues
  content = content.replace(/\.\.\.body/g, '...(body as any)');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed MSW handlers');
}

// Fix test files with missing props
function fixTestFiles() {
  const files = [
    'src/components/CombatTracker.test.tsx',
    'src/components/GameCanvas.test.tsx',
    'src/components/GameLobby.test.tsx',
    'src/components/VTTApp.test.tsx',
    'src/components/CombatTrackerIntegrated.test.tsx'
  ];
  
  files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add React import if missing
    if (!content.includes("import React from")) {
      content = `import React from 'react';\n` + content;
    }
    
    // Fix component-specific issues
    if (file.includes('CombatTracker.test')) {
      // Add mock props for CombatTracker
      if (!content.includes('const defaultProps')) {
        const mockProps = `
const defaultProps = {
  combatants: [],
  currentTurn: 0,
  round: 1,
  isActive: false,
  onAddCombatant: jest.fn(),
  onRemoveCombatant: jest.fn(),
  onUpdateCombatant: jest.fn(),
  onNextTurn: jest.fn(),
  onPreviousTurn: jest.fn(),
  onStartCombat: jest.fn(),
  onEndCombat: jest.fn(),
  onRollInitiative: jest.fn(),
  onSortCombatants: jest.fn(),
  onToggleVisibility: jest.fn()
};
`;
        content = content.replace(/describe\(['"].*['"], \(\) => {/, (match) => match + mockProps);
      }
      
      // Replace <CombatTracker /> with <CombatTracker {...defaultProps} />
      content = content.replace(/<CombatTracker\s*\/>/g, '<CombatTracker {...defaultProps} />');
    }
    
    if (file.includes('GameCanvas.test')) {
      if (!content.includes('const defaultProps')) {
        const mockProps = `
const defaultProps = {
  width: 800,
  height: 600,
  gameId: 'test-game',
  isGM: false
};
`;
        content = content.replace(/describe\(['"].*['"], \(\) => {/, (match) => match + mockProps);
      }
      content = content.replace(/<GameCanvas\s*\/>/g, '<GameCanvas {...defaultProps} />');
    }
    
    if (file.includes('GameLobby.test')) {
      if (!content.includes('const defaultProps')) {
        const mockProps = `
const defaultProps = {
  onJoinGame: jest.fn(),
  onCreateGame: jest.fn(),
  onSpectateGame: jest.fn()
};
`;
        content = content.replace(/describe\(['"].*['"], \(\) => {/, (match) => match + mockProps);
      }
      content = content.replace(/<GameLobby\s*\/>/g, '<GameLobby {...defaultProps} />');
    }
    
    if (file.includes('VTTApp.test')) {
      if (!content.includes('const defaultProps')) {
        const mockProps = `
const defaultProps = {};
`;
        content = content.replace(/describe\(['"].*['"], \(\) => {/, (match) => match + mockProps);
      }
      content = content.replace(/<VTTApp\s*\/>/g, '<VTTApp {...defaultProps} />');
    }
    
    if (file.includes('CombatTrackerIntegrated.test')) {
      // Add missing mock for useEncounter
      if (!content.includes('jest.mock("../hooks/useEncounter"')) {
        content = `jest.mock("../hooks/useEncounter", () => ({
  useEncounter: () => ({
    encounter: null,
    loading: false,
    error: null,
    createEncounter: jest.fn(),
    updateEncounter: jest.fn(),
    deleteEncounter: jest.fn()
  })
}));

` + content;
      }
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  });
}

// Fix component files
function fixComponents() {
  // Fix CombatTrackerIntegrated
  const combatIntPath = path.join(__dirname, 'src/components/CombatTrackerIntegrated.tsx');
  if (fs.existsSync(combatIntPath)) {
    let content = fs.readFileSync(combatIntPath, 'utf8');
    
    // Add React import if missing
    if (!content.includes("import React")) {
      content = `import React, { useState, useCallback, useEffect } from 'react';\n` + content;
    }
    
    // Add missing state variables
    if (!content.includes('const [isActive')) {
      const stateCode = `
  const [isActive, setIsActive] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [round, setRound] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(0);
`;
      content = content.replace(/(export.*function CombatTrackerIntegrated.*{)/, `$1${stateCode}`);
    }
    
    // Add missing functions
    if (!content.includes('const onNextTurn')) {
      const functionsCode = `
  const onNextTurn = useCallback(() => {
    setCurrentTurn(prev => prev + 1);
  }, []);
  
  const onPreviousTurn = useCallback(() => {
    setCurrentTurn(prev => Math.max(0, prev - 1));
  }, []);
  
  const onStartCombat = useCallback(() => {
    setIsActive(true);
  }, []);
  
  const onEndCombat = useCallback(() => {
    setIsActive(false);
    setRound(1);
    setCurrentTurn(0);
  }, []);
`;
      content = content.replace(/(const \[currentTurn.*\n)/, `$1${functionsCode}`);
    }
    
    fs.writeFileSync(combatIntPath, content);
    console.log('Fixed CombatTrackerIntegrated');
  }
  
  // Fix GameCanvas
  const gameCanvasPath = path.join(__dirname, 'src/components/GameCanvas.tsx');
  if (fs.existsSync(gameCanvasPath)) {
    let content = fs.readFileSync(gameCanvasPath, 'utf8');
    
    // Fix context usage
    content = content.replace(/const { .* } = useWebSocket\(\);/, 'const { socket } = useWebSocket();');
    content = content.replace(/const { .* } = useGame\(\);/, 'const { game } = useGame();');
    
    fs.writeFileSync(gameCanvasPath, content);
    console.log('Fixed GameCanvas');
  }
  
  // Fix SceneCanvas
  const sceneCanvasPath = path.join(__dirname, 'src/components/SceneCanvas.tsx');
  if (fs.existsSync(sceneCanvasPath)) {
    let content = fs.readFileSync(sceneCanvasPath, 'utf8');
    
    // Add missing functions
    if (!content.includes('const drawGrid')) {
      const functions = `
  const drawGrid = () => {
    if (!gridGraphics.current) return;
    gridGraphics.current.clear();
    gridGraphics.current.lineStyle(1, 0x444444, 0.5);
    
    const gridSize = 50;
    for (let x = 0; x < canvasWidth; x += gridSize) {
      gridGraphics.current.moveTo(x, 0);
      gridGraphics.current.lineTo(x, canvasHeight);
    }
    for (let y = 0; y < canvasHeight; y += gridSize) {
      gridGraphics.current.moveTo(0, y);
      gridGraphics.current.lineTo(canvasWidth, y);
    }
  };

  const addToken = (token: any) => {
    if (!tokensContainer.current) return;
    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.width = 50;
    sprite.height = 50;
    sprite.x = token.x;
    sprite.y = token.y;
    tokensContainer.current.addChild(sprite);
  };
`;
      content = content.replace(/(export.*function SceneCanvas.*{)/, `$1${functions}`);
    }
    
    fs.writeFileSync(sceneCanvasPath, content);
    console.log('Fixed SceneCanvas');
  }
}

// Fix other component files with errors
function fixOtherComponents() {
  // List of files with simple fixes
  const fixes = [
    {
      file: 'src/components/ai/GenesisWizard.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/campaigns/CreateCampaignModal.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React, { useState } from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/character/AbilityScores.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/combat/CombatEncounterPanel.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React, { useState, useCallback } from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/dashboard/DashboardHome.tsx',
      fix: (content) => {
        // Fix any undefined variable issues
        return content.replace(/\bundefined\b/g, 'null');
      }
    },
    {
      file: 'src/components/dashboard/DashboardLayout.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/map/MapLayersPanel.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React, { useState } from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/map/MapUploadModal.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React, { useState } from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/map/MapViewer.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React, { useRef, useEffect, useState } from 'react';\n` + content;
        }
        return content;
      }
    },
    {
      file: 'src/components/map/SceneSettingsModal.tsx',
      fix: (content) => {
        if (!content.includes('import React')) {
          content = `import React, { useState } from 'react';\n` + content;
        }
        return content;
      }
    }
  ];
  
  fixes.forEach(({ file, fix }) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      content = fix(content);
      fs.writeFileSync(filePath, content);
      console.log(`Fixed ${file}`);
    }
  });
}

// Fix misc issues
function fixMiscIssues() {
  // Fix inputSanitization
  const sanitizePath = path.join(__dirname, 'src/security/inputSanitization.ts');
  if (fs.existsSync(sanitizePath)) {
    let content = fs.readFileSync(sanitizePath, 'utf8');
    content = content.replace(
      /DOMPurify\.sanitize\(input, config\) as string/g,
      'String(DOMPurify.sanitize(input, config))'
    );
    fs.writeFileSync(sanitizePath, content);
    console.log('Fixed inputSanitization');
  }
  
  // Fix design-system.ts
  const designPath = path.join(__dirname, 'src/components/ui/design-system.ts');
  if (fs.existsSync(designPath)) {
    let content = fs.readFileSync(designPath, 'utf8');
    // Add any missing type definitions
    if (!content.includes('export type')) {
      content = `export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';\n` + content;
    }
    fs.writeFileSync(designPath, content);
    console.log('Fixed design-system');
  }
}

// Run all fixes
console.log('Starting comprehensive TypeScript fixes...\n');

fixTsConfig();
fixMswHandlers();
fixTestFiles();
fixComponents();
fixOtherComponents();
fixMiscIssues();

console.log('\nAll fixes applied!');
