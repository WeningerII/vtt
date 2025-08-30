#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Automated script to fix common missing imports
 */

class ImportFixer {
  constructor() {
    this.fixedCount = 0;
    this.filesProcessed = 0;
    this.errors = [];
  }

  // Fix missing React hooks
  fixReactHooks(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      const hooks = [
        'useState', 'useEffect', 'useCallback', 'useMemo', 'useContext',
        'useReducer', 'useRef', 'useLayoutEffect', 'useImperativeHandle',
        'useDebugValue', 'useDeferredValue', 'useTransition', 'useId'
      ];

      // Check which hooks are used
      const usedHooks = hooks.filter(hook => {
        const pattern = new RegExp(`\\b${hook}\\s*\\(`, 'g');
        return pattern.test(content);
      });

      if (usedHooks.length === 0) return false;

      // Check existing React imports
      const hasReactImport = /^import\s+.*from\s+['"]react['"]/m.test(content);
      
      if (!hasReactImport) {
        // Add new React import
        const importStatement = `import React, { ${usedHooks.join(', ')} } from 'react';\n`;
        content = importStatement + content;
        modified = true;
      } else {
        // Update existing React import
        const importMatch = content.match(/^import\s+(.*)\s+from\s+['"]react['"]/m);
        if (importMatch) {
          const currentImport = importMatch[1];
          const existingHooks = new Set();
          
          // Parse existing hooks
          const namedMatch = currentImport.match(/\{([^}]+)\}/);
          if (namedMatch) {
            namedMatch[1].split(',').forEach(h => existingHooks.add(h.trim()));
          }
          
          // Add missing hooks
          const missingHooks = usedHooks.filter(h => !existingHooks.has(h));
          
          if (missingHooks.length > 0) {
            const allHooks = [...existingHooks, ...missingHooks].sort();
            const newImport = currentImport.includes('React') 
              ? `React, { ${allHooks.join(', ')} }`
              : `{ ${allHooks.join(', ')} }`;
            
            content = content.replace(
              /^import\s+.*\s+from\s+['"]react['"]/m,
              `import ${newImport} from 'react'`
            );
            modified = true;
          }
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
      }
      return false;
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      return false;
    }
  }

  // Fix missing cn utility
  fixCnUtility(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if cn is used
      if (!/\bcn\s*\(/g.test(content)) return false;
      
      // Check if already imported
      if (/import\s+.*\bcn\b.*from/m.test(content)) return false;
      
      // Determine import path based on file location
      const fileDir = path.dirname(filePath);
      let importPath = '@/lib/utils';
      
      // Calculate relative path if in apps/client
      if (filePath.includes('apps/client/src/')) {
        const depth = filePath.split('/src/')[1].split('/').length - 1;
        if (depth === 0) {
          importPath = './lib/utils';
        } else if (depth === 1) {
          importPath = '../lib/utils';
        } else if (depth === 2) {
          importPath = '../../lib/utils';
        } else {
          importPath = '../'.repeat(depth) + 'lib/utils';
        }
      }
      
      // Check for existing utils import
      const utilsImportMatch = content.match(/^import\s+\{([^}]+)\}\s+from\s+['"][^'"]*utils['"]/m);
      
      if (utilsImportMatch) {
        // Add cn to existing utils import
        const imports = utilsImportMatch[1].split(',').map(i => i.trim());
        if (!imports.includes('cn')) {
          imports.push('cn');
          const newImport = `import { ${imports.sort().join(', ')} }`;
          content = content.replace(
            /^import\s+\{[^}]+\}\s+from\s+(['"][^'"]*utils['"])/m,
            `${newImport} from $1`
          );
        }
      } else {
        // Add new import at the top
        const importStatement = `import { cn } from '${importPath}';\n`;
        
        // Add after other imports if they exist
        const lastImportMatch = content.match(/^import\s+.*$/m);
        if (lastImportMatch) {
          const lastImportIndex = content.lastIndexOf(lastImportMatch[0]);
          const beforeImport = content.substring(0, lastImportIndex + lastImportMatch[0].length);
          const afterImport = content.substring(lastImportIndex + lastImportMatch[0].length);
          content = beforeImport + '\n' + importStatement + afterImport;
        } else {
          content = importStatement + content;
        }
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      return false;
    }
  }

  // Fix missing Lucide icons
  fixLucideIcons(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Common Lucide icons
      const iconPatterns = [
        'Search', 'Settings', 'User', 'Users', 'Home', 'Menu', 'X', 'Plus', 'Minus',
        'Edit', 'Trash', 'Save', 'Download', 'Upload', 'ChevronLeft', 'ChevronRight',
        'ChevronUp', 'ChevronDown', 'Check', 'AlertCircle', 'Info', 'Copy', 'Eye',
        'EyeOff', 'Lock', 'Unlock', 'Star', 'Heart', 'Send', 'Share', 'Filter',
        'Grid', 'List', 'Loader', 'Loader2', 'Play', 'Pause', 'Sun', 'Moon',
        'Bell', 'Calendar', 'Clock', 'Mail', 'Phone', 'MapPin', 'Globe'
      ];
      
      const usedIcons = [];
      iconPatterns.forEach(icon => {
        const pattern = new RegExp(`<${icon}[\\s/>]`, 'g');
        if (pattern.test(content)) {
          usedIcons.push(icon);
        }
      });
      
      if (usedIcons.length === 0) return false;
      
      // Check existing lucide imports
      const lucideImportMatch = content.match(/^import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/m);
      
      if (lucideImportMatch) {
        // Update existing import
        const existing = lucideImportMatch[1].split(',').map(i => i.trim());
        const toAdd = usedIcons.filter(icon => !existing.includes(icon));
        
        if (toAdd.length > 0) {
          const allIcons = [...existing, ...toAdd].sort();
          content = content.replace(
            /^import\s+\{[^}]+\}\s+from\s+['"]lucide-react['"]/m,
            `import { ${allIcons.join(', ')} } from 'lucide-react'`
          );
          fs.writeFileSync(filePath, content, 'utf8');
          return true;
        }
      } else if (usedIcons.length > 0) {
        // Add new import
        const importStatement = `import { ${usedIcons.sort().join(', ')} } from 'lucide-react';\n`;
        
        // Add after React imports
        const reactImportMatch = content.match(/^import\s+.*\s+from\s+['"]react['"]/m);
        if (reactImportMatch) {
          const index = content.indexOf(reactImportMatch[0]) + reactImportMatch[0].length;
          content = content.substring(0, index) + '\n' + importStatement + content.substring(index);
        } else {
          content = importStatement + content;
        }
        
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
      }
      
      return false;
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      return false;
    }
  }

  processFile(filePath) {
    // Skip non-relevant files
    if (!filePath.match(/\.(tsx?|jsx?)$/) || 
        filePath.includes('node_modules') ||
        filePath.includes('.test.') ||
        filePath.includes('.spec.')) {
      return;
    }

    this.filesProcessed++;
    let fixed = false;

    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      fixed = this.fixReactHooks(filePath) || fixed;
      fixed = this.fixLucideIcons(filePath) || fixed;
    }
    
    fixed = this.fixCnUtility(filePath) || fixed;

    if (fixed) {
      this.fixedCount++;
      console.log(`✅ Fixed imports in: ${filePath}`);
    }
  }

  scanDirectory(dir) {
    const scan = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          
          try {
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
              if (!item.includes('node_modules') && 
                  !item.includes('.git') && 
                  !item.includes('dist') && 
                  !item.includes('build') &&
                  !item.includes('coverage')) {
                scan(fullPath);
              }
            } else if (item.match(/\.(tsx?|jsx?)$/)) {
              this.processFile(fullPath);
            }
          } catch (e) {
            // Skip items we can't stat
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    scan(dir);
  }

  report() {
    console.log('\n=== IMPORT FIX REPORT ===\n');
    console.log(`📊 Files processed: ${this.filesProcessed}`);
    console.log(`✅ Files fixed: ${this.fixedCount}`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.errors.length}`);
      this.errors.forEach(({ file, error }) => {
        console.log(`  • ${file}: ${error}`);
      });
    }
  }
}

// Main execution
console.log('🔧 Starting automated import fixes...\n');

const fixer = new ImportFixer();

// Process specific directories
console.log('Processing apps/client...');
fixer.scanDirectory('/home/weningerii/vtt/apps/client');

console.log('Processing apps/editor...');
fixer.scanDirectory('/home/weningerii/vtt/apps/editor');

console.log('Processing apps/server...');
fixer.scanDirectory('/home/weningerii/vtt/apps/server');

console.log('Processing e2e tests...');
fixer.scanDirectory('/home/weningerii/vtt/e2e');

// Generate report
fixer.report();
