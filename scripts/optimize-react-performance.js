#!/usr/bin/env node

/**
 * React Performance Optimization Script
 * Adds React.memo, useMemo, and useCallback to components that need optimization
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Components to optimize with their specific patterns
const OPTIMIZATION_PATTERNS = {
  // Components that should be wrapped with React.memo
  memoComponents: [
    "AbilityScores",
    "SkillsPanel",
    "EquipmentPanel",
    "SpellsPanel",
    "NotesPanel",
    "LoadingSpinner",
    "Button",
    "Card",
    "Input",
    "ChatSystem",
    "PlayerPanel",
    "MapLayersPanel",
    "TokenPropertiesPanel",
  ],

  // Expensive calculations that should use useMemo
  expensiveCalculations: [
    { pattern: /\.filter\(.*\)\.map\(/g, name: "filter-map chains" },
    { pattern: /\.reduce\(.*complex.*\)/g, name: "complex reduce operations" },
    { pattern: /Object\.entries\(.*\)\.map/g, name: "object transformations" },
    { pattern: /Array\.from\(.*\)\.map/g, name: "array conversions" },
    { pattern: /\.sort\(.*\)/g, name: "sorting operations" },
  ],

  // Event handlers that should use useCallback
  eventHandlers: [
    "onClick",
    "onChange",
    "onSubmit",
    "onKeyDown",
    "onKeyUp",
    "onFocus",
    "onBlur",
    "onMouseEnter",
    "onMouseLeave",
    "onDragStart",
    "onDragEnd",
    "onDrop",
  ],
};

function optimizeComponent(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;
  const fileName = path.basename(filePath);
  const componentName = fileName.replace(".tsx", "");

  // Check if already optimized
  if (content.includes("memo(") && content.includes("useMemo") && content.includes("useCallback")) {
    console.log(`✓ ${fileName} already optimized`);
    return false;
  }

  // Add React.memo to functional components
  if (OPTIMIZATION_PATTERNS.memoComponents.includes(componentName)) {
    if (
      !content.includes(`memo(function ${componentName}`) &&
      !content.includes(`memo(${componentName})`)
    ) {
      // Pattern 1: export const Component = () => {}
      const exportConstPattern = new RegExp(
        `export const ${componentName} = \\(([^)]*?)\\) => \\{`,
        "g",
      );
      if (exportConstPattern.test(content)) {
        content = content.replace(
          exportConstPattern,
          `export const ${componentName} = memo(($1) => {`,
        );

        // Add closing parenthesis for memo
        const lastExportIndex = content.lastIndexOf("export");
        const nextComponentStart = content.indexOf("export", lastExportIndex + 1);
        if (nextComponentStart === -1) {
          // Last component in file
          content = content.replace(/}\s*$/, "});\n");
        } else {
          // Find the end of this component
          let braceCount = 0;
          let inComponent = false;
          let componentEnd = -1;

          for (let i = lastExportIndex; i < content.length; i++) {
            if (content[i] === "{") {
              braceCount++;
              inComponent = true;
            } else if (content[i] === "}") {
              braceCount--;
              if (inComponent && braceCount === 0) {
                componentEnd = i;
                break;
              }
            }
          }

          if (componentEnd > -1) {
            content = content.slice(0, componentEnd + 1) + ")" + content.slice(componentEnd + 1);
          }
        }

        modified = true;
        console.log(`✓ Added React.memo to ${componentName}`);
      }

      // Pattern 2: export function Component() {}
      const exportFunctionPattern = new RegExp(
        `export function ${componentName}\\(([^)]*?)\\)`,
        "g",
      );
      if (exportFunctionPattern.test(content)) {
        content = content.replace(
          exportFunctionPattern,
          `export const ${componentName} = memo(function ${componentName}($1)`,
        );

        // Find and update the closing brace
        const functionStart = content.indexOf(`memo(function ${componentName}`);
        if (functionStart > -1) {
          let braceCount = 0;
          let inFunction = false;

          for (let i = functionStart; i < content.length; i++) {
            if (content[i] === "{") {
              braceCount++;
              inFunction = true;
            } else if (content[i] === "}") {
              braceCount--;
              if (inFunction && braceCount === 0) {
                content = content.slice(0, i + 1) + ")" + content.slice(i + 1);
                break;
              }
            }
          }
        }

        modified = true;
        console.log(`✓ Added React.memo to ${componentName}`);
      }
    }
  }

  // Add useMemo for expensive calculations
  OPTIMIZATION_PATTERNS.expensiveCalculations.forEach(({ pattern, name }) => {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      matches.forEach((match) => {
        // Check if already wrapped in useMemo
        const index = content.indexOf(match);
        const before = content.slice(Math.max(0, index - 50), index);
        if (!before.includes("useMemo")) {
          // Extract the calculation
          const calculation = match;
          const memoized = `useMemo(() => ${calculation}, [/* add dependencies */])`;

          // Only replace if it's assigned to a variable
          const assignmentPattern = new RegExp(
            `const (\\w+) = ${calculation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          );
          if (assignmentPattern.test(content)) {
            content = content.replace(assignmentPattern, `const $1 = ${memoized}`);
            modified = true;
            console.log(`✓ Added useMemo for ${name} in ${fileName}`);
          }
        }
      });
    }
  });

  // Add useCallback for event handlers
  OPTIMIZATION_PATTERNS.eventHandlers.forEach((handler) => {
    const handlerPattern = new RegExp(`${handler}=\\{\\(([^}]*)\\) => \\{([^}]+)\\}\\}`, "g");
    const matches = content.match(handlerPattern);

    if (matches && matches.length > 0) {
      matches.forEach((match) => {
        // Check if already wrapped in useCallback
        if (!match.includes("useCallback")) {
          // Extract handler name from the context
          const handlerVarPattern = new RegExp(`const (\\w+${handler}) = \\(([^)]*)\\) => \\{`);
          const varMatches = content.match(handlerVarPattern);

          if (varMatches && varMatches.length > 0) {
            varMatches.forEach((varMatch) => {
              const handlerName = varMatch.match(/const (\w+) =/)?.[1];
              if (handlerName && !content.includes(`useCallback(`)) {
                const original = varMatch;
                const replacement = varMatch.replace(
                  /const (\w+) = \(([^)]*)\) => \{/,
                  "const $1 = useCallback(($2) => {",
                );

                // Find the closing brace and add dependencies
                const startIndex = content.indexOf(original);
                if (startIndex > -1) {
                  let braceCount = 0;
                  let inHandler = false;

                  for (let i = startIndex; i < content.length; i++) {
                    if (content[i] === "{") {
                      braceCount++;
                      inHandler = true;
                    } else if (content[i] === "}") {
                      braceCount--;
                      if (inHandler && braceCount === 0) {
                        const before = content.slice(0, i + 1);
                        const after = content.slice(i + 1);
                        content = before + ", [/* add dependencies */])" + after;
                        content = content.replace(original, replacement);
                        modified = true;
                        console.log(`✓ Added useCallback for ${handlerName} in ${fileName}`);
                        break;
                      }
                    }
                  }
                }
              }
            });
          }
        }
      });
    }
  });

  // Update imports if needed
  if (modified) {
    // Check current imports
    const hasReactImport = content.includes("import React") || content.includes("from 'react'");
    const hasMemo = content.includes("memo");
    const hasUseMemo = content.includes("useMemo");
    const hasUseCallback = content.includes("useCallback");

    if (hasReactImport) {
      // Update existing React import
      const importPattern = /import \{([^}]+)\} from ['"]react['"]/;
      const importMatch = content.match(importPattern);

      if (importMatch) {
        const imports = importMatch[1].split(",").map((i) => i.trim());
        const newImports = new Set(imports);

        if (hasMemo && !imports.includes("memo")) newImports.add("memo");
        if (hasUseMemo && !imports.includes("useMemo")) newImports.add("useMemo");
        if (hasUseCallback && !imports.includes("useCallback")) newImports.add("useCallback");

        const sortedImports = Array.from(newImports).sort();
        content = content.replace(
          importPattern,
          `import { ${sortedImports.join(", ")} } from 'react'`,
        );
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Optimized ${fileName}`);
    return true;
  }

  return false;
}

function main() {
  console.log("🚀 Starting React Performance Optimization...\n");

  const clientComponentsPath = path.join(__dirname, "../apps/client/src/components");
  const pattern = path.join(clientComponentsPath, "**/*.tsx");

  const files = glob.sync(pattern);
  let optimizedCount = 0;
  let skippedCount = 0;

  files.forEach((file) => {
    // Skip test files
    if (file.includes(".test.") || file.includes(".spec.")) {
      return;
    }

    if (optimizeComponent(file)) {
      optimizedCount++;
    } else {
      skippedCount++;
    }
  });

  console.log("\n📊 Optimization Summary:");
  console.log(`✅ Optimized: ${optimizedCount} components`);
  console.log(`⏭️  Skipped (already optimized): ${skippedCount} components`);
  console.log(`📁 Total processed: ${files.length} files`);

  // Create performance monitoring component
  const perfMonitorPath = path.join(clientComponentsPath, "PerformanceMonitor.tsx");
  if (!fs.existsSync(perfMonitorPath)) {
    const perfMonitorContent = `import { useEffect, useState, memo } from 'react';
import { logger } from '@vtt/logging';

interface PerformanceMetrics {
  renderTime: number;
  componentCount: number;
  memoryUsage: number;
  fps: number;
}

export const PerformanceMonitor = memo(function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    componentCount: 0,
    memoryUsage: 0,
    fps: 0
  });
  
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;
    
    const measureFPS = () => {
      const currentTime = performance.now();
      frameCount++;
      
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        // Get memory usage if available
        const memoryUsage = (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : 0;
        
        setMetrics(prev => ({
          ...prev,
          fps,
          memoryUsage,
          renderTime: Math.round(currentTime - lastTime)
        }));
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      rafId = requestAnimationFrame(measureFPS);
    };
    
    if (isVisible) {
      rafId = requestAnimationFrame(measureFPS);
    }
    
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isVisible]);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <>
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white px-3 py-1 rounded text-xs"
      >
        {isVisible ? 'Hide' : 'Show'} Performance
      </button>
      
      {isVisible && (
        <div className="fixed bottom-16 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-lg text-xs font-mono">
          <h3 className="font-bold mb-2">Performance Metrics</h3>
          <div className="space-y-1">
            <div>FPS: <span className={metrics.fps < 30 ? 'text-red-400' : 'text-green-400'}>{metrics.fps}</span></div>
            <div>Memory: {metrics.memoryUsage} MB</div>
            <div>Render: {metrics.renderTime} ms</div>
          </div>
        </div>
      )}
    </>
  );
});
`;

    fs.writeFileSync(perfMonitorPath, perfMonitorContent);
    console.log("\n✨ Created PerformanceMonitor component");
  }

  console.log("\n✅ React performance optimization complete!");
  console.log("📝 Note: Review the added dependencies in useMemo and useCallback hooks");
}

// Check if glob is installed
try {
  require.resolve("glob");
  main();
} catch (e) {
  console.log("Installing required dependency: glob");
  const { execSync } = require("child_process");
  execSync("npm install --save-dev glob", { stdio: "inherit" });
  main();
}
