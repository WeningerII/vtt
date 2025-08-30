#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Components that need keyboard navigation
const componentsToFix = [
  'CombatTracker.tsx',
  'CombatTrackerIntegrated.tsx',
  'MonsterBrowser.tsx',
  'CharacterSheet.tsx',
  'DiceRoller.tsx',
  'GameLobby.tsx',
  'MapEditor.tsx',
  'AIAssistant.tsx',
  'EncounterGenerator.tsx'
];

function addKeyboardNavigation(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const fileName = path.basename(filePath);
  
  // Add keyboard event handlers for buttons if not present
  if (!content.includes('onKeyDown') && content.includes('<button')) {
    
    // For CombatTracker - add keyboard shortcuts
    if (fileName === 'CombatTracker.tsx' || fileName === 'CombatTrackerIntegrated.tsx') {
      // Add useEffect for keyboard shortcuts
      const importLine = content.match(/import React.*from 'react';/);
      if (importLine && !content.includes('useEffect')) {
        content = content.replace(
          /import React, \{ useState/g,
          'import React, { useState, useEffect'
        );
        modified = true;
      }
      
      // Add keyboard handler after component declaration
      const componentStart = content.indexOf('export const CombatTracker');
      if (componentStart !== -1) {
        const functionBodyStart = content.indexOf('{', componentStart);
        const firstHook = content.indexOf('useState', functionBodyStart);
        if (firstHook !== -1) {
          const insertPoint = content.indexOf('\n', firstHook) + 1;
          
          const keyboardHandler = `
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      
      // Keyboard shortcuts
      switch(e.key) {
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onNextTurn();
          }
          break;
        case 'p':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onPreviousTurn();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (isActive) {
              onEndCombat();
            } else {
              onStartCombat();
            }
          }
          break;
        case 'Escape':
          setShowAddForm(false);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, readOnly, onNextTurn, onPreviousTurn, onStartCombat, onEndCombat]);
`;
          
          if (!content.includes('handleKeyDown')) {
            content = content.slice(0, insertPoint) + keyboardHandler + content.slice(insertPoint);
            modified = true;
          }
        }
      }
    }
    
    // For MonsterBrowser - add arrow key navigation
    if (fileName === 'MonsterBrowser.tsx') {
      const importLine = content.match(/import React.*from 'react';/);
      if (importLine && !content.includes('useEffect')) {
        content = content.replace(
          /import React, \{ useState/g,
          'import React, { useState, useEffect'
        );
        modified = true;
      }
      
      // Add keyboard navigation for monster selection
      const componentStart = content.indexOf('export const MonsterBrowser');
      if (componentStart !== -1 && !content.includes('handleKeyDown')) {
        const functionBodyStart = content.indexOf('{', componentStart);
        const firstHook = content.indexOf('useState', functionBodyStart);
        if (firstHook !== -1) {
          const insertPoint = content.indexOf('\n', firstHook) + 1;
          
          const keyboardHandler = `
  // Keyboard navigation for monster selection
  const [focusedIndex, setFocusedIndex] = useState(0);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const monsterCount = filteredMonsters.length;
      if (monsterCount === 0) return;
      
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => (prev + 1) % monsterCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => (prev - 1 + monsterCount) % monsterCount);
          break;
        case 'Enter':
          if (e.ctrlKey && multiSelect) {
            const monster = filteredMonsters[focusedIndex];
            if (monster) {
              handleToggleSelect(monster.id);
            }
          } else if (onSelectMonster) {
            const monster = filteredMonsters[focusedIndex];
            if (monster) {
              onSelectMonster(monster);
            }
          }
          break;
        case ' ':
          if (multiSelect) {
            e.preventDefault();
            const monster = filteredMonsters[focusedIndex];
            if (monster) {
              handleToggleSelect(monster.id);
            }
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredMonsters, focusedIndex, multiSelect, onSelectMonster]);
`;
          
          content = content.slice(0, insertPoint) + keyboardHandler + content.slice(insertPoint);
          modified = true;
        }
      }
    }
    
    // For DiceRoller - add keyboard shortcut for rolling
    if (fileName === 'DiceRoller.tsx') {
      const componentStart = content.indexOf('export const DiceRoller');
      if (componentStart !== -1 && !content.includes('handleKeyDown')) {
        const functionBodyStart = content.indexOf('{', componentStart);
        const firstHook = content.indexOf('useState', functionBodyStart);
        if (firstHook !== -1) {
          const insertPoint = content.indexOf('\n', firstHook) + 1;
          
          const keyboardHandler = `
  // Keyboard shortcut for rolling dice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRoll();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
`;
          
          content = content.slice(0, insertPoint) + keyboardHandler + content.slice(insertPoint);
          modified = true;
        }
      }
    }
  }
  
  // Add tabIndex to interactive elements
  if (!content.includes('tabIndex')) {
    // Add tabIndex to buttons
    content = content.replace(/<button([^>]*?)>/g, (match, attrs) => {
      if (!attrs.includes('tabIndex')) {
        return `<button${attrs} tabIndex={0}>`;
      }
      return match;
    });
    
    // Add tabIndex to clickable divs
    content = content.replace(/<div([^>]*?)onClick=/g, (match, attrs) => {
      if (!attrs.includes('tabIndex')) {
        return `<div${attrs} tabIndex={0} onClick=`;
      }
      return match;
    });
    
    if (content.includes('tabIndex={0}')) {
      modified = true;
    }
  }
  
  // Add role attributes for accessibility
  if (!content.includes('role=')) {
    // Add role="button" to clickable divs
    content = content.replace(/<div([^>]*?)onClick=/g, (match, attrs) => {
      if (!attrs.includes('role=')) {
        return `<div${attrs} role="button" onClick=`;
      }
      return match;
    });
    
    if (content.includes('role="button"')) {
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Process each component
let fixedCount = 0;
componentsToFix.forEach(fileName => {
  const filePath = path.join('/home/weningerii/vtt/apps/client/src/components', fileName);
  if (fs.existsSync(filePath)) {
    if (addKeyboardNavigation(filePath)) {
      console.log(`Added keyboard navigation to: ${fileName}`);
      fixedCount++;
    }
  }
});

console.log(`\nAdded keyboard navigation to ${fixedCount} components`);
