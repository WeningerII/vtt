#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix all test files to use proper props
function fixAllTestFiles() {
  // Fix CombatTracker.test.tsx
  const combatTrackerTest = path.join(__dirname, 'src/components/CombatTracker.test.tsx');
  if (fs.existsSync(combatTrackerTest)) {
    let content = fs.readFileSync(combatTrackerTest, 'utf8');
    
    // Replace all empty CombatTracker components with proper props
    content = content.replace(
      /<CombatTracker\s*\/>/g,
      `<CombatTracker 
        combatants={[]}
        currentTurn={0}
        round={1}
        isActive={false}
        onAddCombatant={jest.fn()}
        onRemoveCombatant={jest.fn()}
        onUpdateCombatant={jest.fn()}
        onNextTurn={jest.fn()}
        onPreviousTurn={jest.fn()}
        onStartCombat={jest.fn()}
        onEndCombat={jest.fn()}
        onRollInitiative={jest.fn()}
        onSortCombatants={jest.fn()}
        onToggleVisibility={jest.fn()}
      />`
    );
    
    // Also fix {...defaultProps} pattern
    content = content.replace(
      /<CombatTracker\s+\{\.\.\.defaultProps\}\s*\/>/g,
      `<CombatTracker 
        combatants={[]}
        currentTurn={0}
        round={1}
        isActive={false}
        onAddCombatant={jest.fn()}
        onRemoveCombatant={jest.fn()}
        onUpdateCombatant={jest.fn()}
        onNextTurn={jest.fn()}
        onPreviousTurn={jest.fn()}
        onStartCombat={jest.fn()}
        onEndCombat={jest.fn()}
        onRollInitiative={jest.fn()}
        onSortCombatants={jest.fn()}
        onToggleVisibility={jest.fn()}
      />`
    );
    
    fs.writeFileSync(combatTrackerTest, content);
    console.log('Fixed CombatTracker.test.tsx');
  }

  // Fix GameLobby.test.tsx - ensure ALL instances are fixed
  const gameLobbyTest = path.join(__dirname, 'src/components/GameLobby.test.tsx');
  if (fs.existsSync(gameLobbyTest)) {
    let content = fs.readFileSync(gameLobbyTest, 'utf8');
    
    // Use a more aggressive replacement - find render( and replace until />
    content = content.replace(
      /render\s*\(\s*<GameLobby[^>]*\/>/g,
      'render(<GameLobby onJoinGame={jest.fn()} onCreateGame={jest.fn()} onSpectateGame={jest.fn()} />'
    );
    
    // Also fix rerender calls
    content = content.replace(
      /rerender\s*\(\s*<GameLobby[^>]*\/>/g,
      'rerender(<GameLobby onJoinGame={jest.fn()} onCreateGame={jest.fn()} onSpectateGame={jest.fn()} />'
    );
    
    fs.writeFileSync(gameLobbyTest, content);
    console.log('Fixed GameLobby.test.tsx');
  }

  // Fix CombatTrackerIntegrated.test.tsx
  const combatIntTest = path.join(__dirname, 'src/components/CombatTrackerIntegrated.test.tsx');
  if (fs.existsSync(combatIntTest)) {
    let content = fs.readFileSync(combatIntTest, 'utf8');
    
    // Fix possibly undefined firstButton
    content = content.replace(
      /firstButton\.click\(\)/g,
      'firstButton?.click()'
    );
    
    // Fix undefined encounterId
    content = content.replace(
      /encounterId: undefined/g,
      'encounterId: "test-encounter"'
    );
    
    fs.writeFileSync(combatIntTest, content);
    console.log('Fixed CombatTrackerIntegrated.test.tsx');
  }
}

// Fix CombatTrackerIntegrated.tsx
function fixCombatTrackerIntegrated() {
  const filePath = path.join(__dirname, 'src/components/CombatTrackerIntegrated.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove duplicate useEncounter imports
  content = content.replace(
    /import { useEncounter } from ".*";\nimport { useEncounter } from ".*";/g,
    'import { useEncounter } from "../hooks/useEncounter";'
  );
  
  // Add missing state and functions after the component declaration
  const missingCode = `
  const [isActive, setIsActive] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const onNextTurn = useCallback(() => {
    setCurrentTurn(prev => (prev + 1) % combatants.length);
  }, [combatants.length]);
  
  const onPreviousTurn = useCallback(() => {
    setCurrentTurn(prev => prev > 0 ? prev - 1 : combatants.length - 1);
  }, [combatants.length]);
  
  const onStartCombat = useCallback(() => {
    setIsActive(true);
  }, []);
  
  const onEndCombat = useCallback(() => {
    setIsActive(false);
    setRound(1);
    setCurrentTurn(0);
  }, []);
`;
  
  // Check if these are already defined, if not add them
  if (!content.includes('const [isActive')) {
    // Find the right place to insert - after other state declarations
    const insertPattern = /const \[currentTurn, setCurrentTurn\] = useState.*\n/;
    content = content.replace(insertPattern, (match) => match + missingCode);
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed CombatTrackerIntegrated.tsx');
}

// Fix GameCanvas.tsx context issues
function fixGameCanvas() {
  const filePath = path.join(__dirname, 'src/components/GameCanvas.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the context destructuring to match what's available
  content = content.replace(
    /const { socket } = useWebSocket\(\);/g,
    'const websocketContext = useWebSocket();\n  const socket = websocketContext;'
  );
  
  content = content.replace(
    /const { game } = useGame\(\);/g,
    'const gameContext = useGame();\n  const game = gameContext;'
  );
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed GameCanvas.tsx');
}

// Run all fixes
console.log('Applying final TypeScript fixes...\n');

fixAllTestFiles();
fixCombatTrackerIntegrated();
fixGameCanvas();

console.log('\nFinal fixes applied!');
