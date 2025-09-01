#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix test files that are missing mockProps
function fixTestMockProps() {
  // Fix CombatTracker.test.tsx
  const combatTrackerTest = path.join(__dirname, 'src/components/CombatTracker.test.tsx');
  if (fs.existsSync(combatTrackerTest)) {
    let content = fs.readFileSync(combatTrackerTest, 'utf8');
    
    // Check if mockProps already exists, if not add it properly
    if (!content.includes('const mockProps')) {
      // Find the describe block and add mockProps inside it
      content = content.replace(
        /describe\(['"]CombatTracker['"], \(\) => \{/,
        `describe('CombatTracker', () => {
  const mockProps = {
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
  };`
      );
    }
    
    fs.writeFileSync(combatTrackerTest, content);
    console.log('Fixed CombatTracker.test.tsx');
  }

  // Fix GameCanvas.test.tsx
  const gameCanvasTest = path.join(__dirname, 'src/components/GameCanvas.test.tsx');
  if (fs.existsSync(gameCanvasTest)) {
    let content = fs.readFileSync(gameCanvasTest, 'utf8');
    
    if (!content.includes('const mockProps')) {
      content = content.replace(
        /describe\(['"]GameCanvas['"], \(\) => \{/,
        `describe('GameCanvas', () => {
  const mockProps = {
    width: 800,
    height: 600,
    gameId: 'test-game-id',
    isGM: false
  };`
      );
    }
    
    fs.writeFileSync(gameCanvasTest, content);
    console.log('Fixed GameCanvas.test.tsx');
  }

  // Fix GameLobby.test.tsx
  const gameLobbyTest = path.join(__dirname, 'src/components/GameLobby.test.tsx');
  if (fs.existsSync(gameLobbyTest)) {
    let content = fs.readFileSync(gameLobbyTest, 'utf8');
    
    // Replace all <GameLobby /> with proper props
    content = content.replace(
      /<GameLobby\s*\/>/g,
      '<GameLobby onJoinGame={jest.fn()} onCreateGame={jest.fn()} onSpectateGame={jest.fn()} />'
    );
    
    fs.writeFileSync(gameLobbyTest, content);
    console.log('Fixed GameLobby.test.tsx');
  }
}

// Fix GameCanvas.tsx
function fixGameCanvas() {
  const filePath = path.join(__dirname, 'src/components/GameCanvas.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix context usage
  content = content.replace(/\bsocket\./g, 'websocket.');
  content = content.replace(/\bgame\./g, 'currentGame.');
  
  // Fix ws references - should be websocket from context
  content = content.replace(/\bws\./g, 'websocket.');
  content = content.replace(/\bws\b/g, 'websocket');
  
  // Ensure proper destructuring from contexts
  const contextPattern = /const \{ .*? \} = useWebSocket\(\);/;
  if (!content.match(contextPattern)) {
    content = content.replace(
      /const.*=.*useWebSocket\(\);/,
      'const { socket: websocket } = useWebSocket();'
    );
  }
  
  const gameContextPattern = /const \{ .*? \} = useGame\(\);/;
  if (!content.match(gameContextPattern)) {
    content = content.replace(
      /const.*=.*useGame\(\);/,
      'const { game: currentGame } = useGame();'
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed GameCanvas.tsx');
}

// Fix SceneCanvas.tsx
function fixSceneCanvas() {
  const filePath = path.join(__dirname, 'src/components/SceneCanvas.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove underscores from props
  content = content.replace(/_scene/g, 'scene');
  content = content.replace(/_socket/g, 'socket');
  content = content.replace(/_canvasWidth/g, 'canvasWidth');
  content = content.replace(/_canvasHeight/g, 'canvasHeight');
  content = content.replace(/_isGM/g, 'isGM');
  
  // Fix property access
  content = content.replace(/\._x/g, '.x');
  content = content.replace(/\._y/g, '.y');
  content = content.replace(/\._rotation/g, '.rotation');
  
  // Add missing function declarations
  if (!content.includes('const drawGrid')) {
    const drawGridFunc = `
  const drawGrid = () => {
    // Grid drawing logic
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
    // Token adding logic
    if (!tokensContainer.current) return;
    const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
    sprite.width = 50;
    sprite.height = 50;
    sprite.x = token.x;
    sprite.y = token.y;
    tokensContainer.current.addChild(sprite);
  };
`;
    // Insert after the component function declaration
    content = content.replace(
      /export.*function SceneCanvas.*\{.*\n/,
      (match) => match + drawGridFunc
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed SceneCanvas.tsx');
}

// Fix LazyWrapper.tsx
function fixLazyWrapper() {
  const filePath = path.join(__dirname, 'src/components/LazyWrapper.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the component prop spreading issue
  content = content.replace(
    /<Component \{\.\.\.props\} ref=\{ref\} \/>/g,
    '<Component {...(props as P)} ref={ref} />'
  );
  
  // Fix entry possibly undefined
  content = content.replace(
    /entry\./g,
    'entry?.'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed LazyWrapper.tsx');
}

// Fix PerformanceMonitor.tsx
function fixPerformanceMonitor() {
  const filePath = path.join(__dirname, 'src/components/PerformanceMonitor.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix useRef call
  content = content.replace(
    /useRef<[^>]+>\(\)/g,
    (match) => match.replace('()', '(null)')
  );
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed PerformanceMonitor.tsx');
}

// Install missing PIXI dependencies
function installPixiDeps() {
  console.log('Installing PIXI.js dependencies...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install pixi.js pixi-viewport', { 
      cwd: __dirname,
      stdio: 'inherit'
    });
    console.log('PIXI.js dependencies installed');
  } catch (error) {
    console.log('Failed to install PIXI.js dependencies');
  }
}

// Run all fixes
console.log('Starting final TypeScript fixes...\n');

fixTestMockProps();
fixGameCanvas();
fixSceneCanvas();
fixLazyWrapper();
fixPerformanceMonitor();
installPixiDeps();

console.log('\nFinal TypeScript fixes applied!');
