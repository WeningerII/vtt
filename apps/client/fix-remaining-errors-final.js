#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix test files with proper props
function fixTestFiles() {
  // Fix GameLobby.test.tsx
  const gameLobbyTest = path.join(__dirname, 'src/components/GameLobby.test.tsx');
  if (fs.existsSync(gameLobbyTest)) {
    let content = fs.readFileSync(gameLobbyTest, 'utf8');
    
    // Replace all <GameLobby /> with proper props
    content = content.replace(
      /<GameLobby\s*\/>/g,
      '<GameLobby onJoinGame={jest.fn()} onCreateGame={jest.fn()} onSpectateGame={jest.fn()} />'
    );
    
    // Also fix {...defaultProps} pattern if it exists
    content = content.replace(
      /<GameLobby\s+\{\.\.\.defaultProps\}\s*\/>/g,
      '<GameLobby onJoinGame={jest.fn()} onCreateGame={jest.fn()} onSpectateGame={jest.fn()} />'
    );
    
    fs.writeFileSync(gameLobbyTest, content);
    console.log('Fixed GameLobby.test.tsx');
  }

  // Fix VTTApp.test.tsx
  const vttAppTest = path.join(__dirname, 'src/components/VTTApp.test.tsx');
  if (fs.existsSync(vttAppTest)) {
    let content = fs.readFileSync(vttAppTest, 'utf8');
    
    // Replace all <VTTApp /> with proper props
    content = content.replace(
      /<VTTApp\s*\/>/g,
      '<VTTApp userId="test-user" campaignId="test-campaign" />'
    );
    
    content = content.replace(
      /<VTTApp\s+\{\.\.\.defaultProps\}\s*\/>/g,
      '<VTTApp userId="test-user" campaignId="test-campaign" />'
    );
    
    fs.writeFileSync(vttAppTest, content);
    console.log('Fixed VTTApp.test.tsx');
  }

  // Fix CombatTracker.test.tsx
  const combatTrackerTest = path.join(__dirname, 'src/components/CombatTracker.test.tsx');
  if (fs.existsSync(combatTrackerTest)) {
    let content = fs.readFileSync(combatTrackerTest, 'utf8');
    
    // Make sure defaultProps is used properly
    if (content.includes('defaultProps')) {
      content = content.replace(
        /<CombatTracker\s*\/>/g,
        '<CombatTracker {...defaultProps} />'
      );
    }
    
    fs.writeFileSync(combatTrackerTest, content);
    console.log('Fixed CombatTracker.test.tsx');
  }

  // Fix GameCanvas.test.tsx
  const gameCanvasTest = path.join(__dirname, 'src/components/GameCanvas.test.tsx');
  if (fs.existsSync(gameCanvasTest)) {
    let content = fs.readFileSync(gameCanvasTest, 'utf8');
    
    if (content.includes('defaultProps')) {
      content = content.replace(
        /<GameCanvas\s*\/>/g,
        '<GameCanvas {...defaultProps} />'
      );
    }
    
    fs.writeFileSync(gameCanvasTest, content);
    console.log('Fixed GameCanvas.test.tsx');
  }
}

// Fix SceneCanvas.tsx
function fixSceneCanvas() {
  const filePath = path.join(__dirname, 'src/components/SceneCanvas.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix property access (remove underscores)
  content = content.replace(/\._x/g, '.x');
  content = content.replace(/\._y/g, '.y');
  content = content.replace(/\._rotation/g, '.rotation');
  
  // Add all missing functions
  if (!content.includes('const drawGrid =')) {
    const functionsToAdd = `
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
    sprite.name = token.id || 'token';
    tokensContainer.current.addChild(sprite);
  };

  const drawHexagon = (graphics: PIXI.Graphics, x: number, y: number, radius: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      points.push(
        x + radius * Math.cos(angle),
        y + radius * Math.sin(angle)
      );
    }
    graphics.drawPolygon(points);
  };
`;
    
    // Find a good place to insert the functions
    const insertPos = content.indexOf('useEffect(() => {');
    if (insertPos > 0) {
      content = content.slice(0, insertPos) + functionsToAdd + '\n\n  ' + content.slice(insertPos);
    }
  }
  
  // Fix undefined variables in event handlers
  content = content.replace(/tokenId(?![a-zA-Z])/g, 'token.id');
  content = content.replace(/\bx\s*\+\s*radius/g, 'centerX + radius');
  content = content.replace(/\by\s*[+-]\s*radius/g, 'centerY + radius');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed SceneCanvas.tsx');
}

// Fix CreateCampaignModal
function fixCreateCampaignModal() {
  const filePath = path.join(__dirname, 'src/components/campaigns/CreateCampaignModal.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix prop names (remove underscores)
  content = content.replace(/_onClose/g, 'onClose');
  content = content.replace(/_onSuccess/g, 'onSuccess');
  
  // Fix undefined variables
  content = content.replace(/\bfield\b(?!:)/g, 'name');
  content = content.replace(/\bvalue\b(?!:)/g, 'e.target.value');
  
  // Fix missing X icon import
  if (!content.includes('import { X }')) {
    content = content.replace(
      /import { /,
      'import { X, '
    );
  }
  
  // Fix system variable references
  content = content.replace(/\bsystem\b(?!:)/g, 'formData.system');
  
  // Fix option variable
  content = content.replace(/\boption\b(?!:)/g, 'opt');
  
  // Add generateId if missing
  if (!content.includes('const generateId')) {
    const generateIdFunc = `
const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};
`;
    content = content.replace(
      /export.*function CreateCampaignModal/,
      generateIdFunc + '\n\nexport function CreateCampaignModal'
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed CreateCampaignModal.tsx');
}

// Fix other component files
function fixOtherComponents() {
  // Fix GenesisWizard - install framer-motion
  console.log('Installing framer-motion...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install framer-motion', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (error) {
    console.log('Failed to install framer-motion');
  }
  
  // Fix character components
  const charFiles = [
    'src/components/character/AbilityScores.tsx',
    'src/components/combat/CombatEncounterPanel.tsx',
    'src/components/dashboard/DashboardHome.tsx',
    'src/components/dashboard/DashboardLayout.tsx',
    'src/components/map/MapLayersPanel.tsx',
    'src/components/map/MapUploadModal.tsx',
    'src/components/map/MapViewer.tsx',
    'src/components/map/SceneSettingsModal.tsx'
  ];
  
  charFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add React import if missing
    if (!content.includes('import React')) {
      content = `import React, { useState, useEffect, useCallback, useRef } from 'react';\n` + content;
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  });
}

// Fix MSW handlers
function fixMswHandlers() {
  const filePath = path.join(__dirname, 'src/test-utils/msw-handlers.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix handler signatures for MSW v2
  content = content.replace(/\({ request }\) =>/g, 'async ({ request }) =>');
  
  // Fix body access
  content = content.replace(/const body = await request\.json\(\);/g, 'const body = await request.json() as any;');
  
  // Fix timeout handler
  content = content.replace(
    /http\.get\("\/api\/test\/timeout".*?\n.*?\n.*?\}\),/s,
    `http.get("/api/test/timeout", async ({ request }) => {
    await new Promise(resolve => setTimeout(resolve, 5000));
    return HttpResponse.json({ message: "This should timeout" });
  }),`
  );
  
  // Fix network error handler
  content = content.replace(
    /http\.get\("\/api\/test\/network-error".*?\n.*?\}\),/s,
    `http.get("/api/test/network-error", async ({ request }) => {
    throw new Error("Network error");
  }),`
  );
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed MSW handlers');
}

// Fix design-system.ts
function fixDesignSystem() {
  const filePath = path.join(__dirname, 'src/components/ui/design-system.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add missing type exports and fix any type issues
  if (!content.includes('export interface')) {
    const typeDefinitions = `
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}
`;
    content = typeDefinitions + '\n' + content;
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed design-system.ts');
}

// Fix hooks
function fixHooks() {
  // Fix custom.ts
  const customPath = path.join(__dirname, 'src/hooks/custom.ts');
  if (fs.existsSync(customPath)) {
    let content = fs.readFileSync(customPath, 'utf8');
    
    // Add React import if missing
    if (!content.includes('import { use')) {
      content = `import { useState, useEffect, useCallback, useRef } from 'react';\n` + content;
    }
    
    fs.writeFileSync(customPath, content);
    console.log('Fixed custom.ts');
  }
  
  // Fix index.ts
  const indexPath = path.join(__dirname, 'src/hooks/index.ts');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Remove or comment out problematic exports
    content = content.replace(/export.*ReducerAction.*\n/g, '// $&');
    
    fs.writeFileSync(indexPath, content);
    console.log('Fixed hooks/index.ts');
  }
}

// Fix GameClient
function fixGameClient() {
  const filePath = path.join(__dirname, 'src/game/GameClient.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add missing imports
  if (!content.includes('import { Socket }')) {
    content = `import { Socket } from 'socket.io-client';\n` + content;
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed GameClient.ts');
}

// Run all fixes
console.log('Starting final TypeScript fixes...\n');

fixTestFiles();
fixSceneCanvas();
fixCreateCampaignModal();
fixOtherComponents();
fixMswHandlers();
fixDesignSystem();
fixHooks();
fixGameClient();

console.log('\nAll fixes applied!');
