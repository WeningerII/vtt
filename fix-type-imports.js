#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

/**
 * Script to fix common missing type imports in TypeScript files
 */

class TypeImportFixer {
  constructor() {
    this.fixedCount = 0;
    this.filesProcessed = 0;
    this.errors = [];

    // Map of common types to their import sources
    this.typeMap = {
      // Node/Browser types
      Buffer: { source: "node:buffer", named: true },
      NodeJS: { source: "@types/node", skip: true }, // Usually ambient

      // React types
      ReactNode: { source: "react", named: true },
      ReactElement: { source: "react", named: true },
      FC: { source: "react", named: true },
      ComponentProps: { source: "react", named: true },
      PropsWithChildren: { source: "react", named: true },
      CSSProperties: { source: "react", named: true },
      MouseEvent: { source: "react", named: true },
      ChangeEvent: { source: "react", named: true },
      FormEvent: { source: "react", named: true },
      KeyboardEvent: { source: "react", named: true },

      // WebGPU types (for renderer package)
      GPUDevice: { source: "@webgpu/types", named: true },
      GPURenderPipeline: { source: "@webgpu/types", named: true },
      GPUTexture: { source: "@webgpu/types", named: true },
      GPUBuffer: { source: "@webgpu/types", named: true },
      GPUBindGroup: { source: "@webgpu/types", named: true },
      GPUCommandEncoder: { source: "@webgpu/types", named: true },
      GPURenderPassEncoder: { source: "@webgpu/types", named: true },
      GPUComputePipeline: { source: "@webgpu/types", named: true },
      GPUTextureUsage: { source: "@webgpu/types", named: true },
      GPUBufferUsage: { source: "@webgpu/types", named: true },
      GPUCanvasContext: { source: "@webgpu/types", named: true },

      // Common utility types
      Prisma: { source: "@prisma/client", named: true },
      PrismaClient: { source: "@prisma/client", named: true },
      JsonValue: { source: "type-fest", named: true },
      DeepPartial: { source: "type-fest", named: true },
      DeepReadonly: { source: "type-fest", named: true },
    };
  }

  analyzeFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, "utf8");
      let modified = false;
      const addedImports = [];

      // Find all used types
      const typeRegex = /(?::\s*|extends\s+|implements\s+|<)([A-Z]\w+)(?:<[^>]+>)?/g;
      const usedTypes = new Set();
      let match;

      while ((match = typeRegex.exec(content)) !== null) {
        const typeName = match[1];

        // Skip built-in types
        const builtins = [
          "Promise",
          "Array",
          "Object",
          "String",
          "Number",
          "Boolean",
          "Date",
          "Error",
          "Map",
          "Set",
          "WeakMap",
          "WeakSet",
          "RegExp",
          "Function",
          "Symbol",
          "Record",
          "Partial",
          "Required",
          "Readonly",
          "Pick",
          "Omit",
          "Exclude",
          "Extract",
          "NonNullable",
          "Parameters",
          "ReturnType",
          "ConstructorParameters",
          "InstanceType",
          "HTMLElement",
          "HTMLDivElement",
          "HTMLInputElement",
          "HTMLButtonElement",
          "HTMLFormElement",
          "HTMLAnchorElement",
          "HTMLImageElement",
          "HTMLCanvasElement",
          "HTMLVideoElement",
          "HTMLAudioElement",
          "Math",
          "JSON",
          "Console",
          "Window",
          "Document",
          "Float32Array",
          "Uint32Array",
          "Int32Array",
          "Uint8Array",
          "ArrayBuffer",
          "DataView",
        ];

        if (!builtins.includes(typeName)) {
          usedTypes.add(typeName);
        }
      }

      // Check if types are already imported or defined
      const missingTypes = [];

      usedTypes.forEach((type) => {
        // Check if imported
        const importRegex = new RegExp(`import.*\\b${type}\\b.*from`, "m");
        const isImported = importRegex.test(content);

        // Check if locally defined
        const definedRegex = new RegExp(`(?:interface|type|class|enum|const)\\s+${type}\\b`, "m");
        const isDefined = definedRegex.test(content);

        // Check if it's a known type we can fix
        if (!isImported && !isDefined && this.typeMap[type] && !this.typeMap[type].skip) {
          missingTypes.push(type);
        }
      });

      // Group imports by source
      const importGroups = {};
      missingTypes.forEach((type) => {
        const info = this.typeMap[type];
        if (!importGroups[info.source]) {
          importGroups[info.source] = [];
        }
        importGroups[info.source].push(type);
      });

      // Add imports
      Object.entries(importGroups).forEach(([source, types]) => {
        const importStatement = `import type { ${types.join(", ")} } from '${source}';\n`;

        // Find the best place to add the import
        const lastImportMatch = content.match(/^import[^;]+;?$/m);

        if (lastImportMatch) {
          // Add after the last import
          const lastImportIndex = content.lastIndexOf(lastImportMatch[0]);
          const beforeImport = content.substring(0, lastImportIndex + lastImportMatch[0].length);
          const afterImport = content.substring(lastImportIndex + lastImportMatch[0].length);
          content = beforeImport + "\n" + importStatement + afterImport;
        } else {
          // Add at the beginning
          content = importStatement + content;
        }

        addedImports.push(...types);
        modified = true;
      });

      if (modified) {
        fs.writeFileSync(filePath, content, "utf8");
        console.log(`✅ Fixed type imports in: ${filePath}`);
        console.log(`   Added: ${addedImports.join(", ")}`);
        this.fixedCount++;
        return true;
      }

      return false;
    } catch (error) {
      this.errors.push({ file: filePath, error: error.message });
      return false;
    }
  }

  processFile(filePath) {
    // Only process TypeScript files
    if (
      !filePath.match(/\.(ts|tsx)$/) ||
      filePath.includes("node_modules") ||
      filePath.includes(".test.") ||
      filePath.includes(".spec.") ||
      filePath.includes(".d.ts")
    ) {
      return;
    }

    this.filesProcessed++;
    this.analyzeFile(filePath);
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
              if (
                !item.includes("node_modules") &&
                !item.includes(".git") &&
                !item.includes("dist") &&
                !item.includes("build") &&
                !item.includes("coverage")
              ) {
                scan(fullPath);
              }
            } else if (item.match(/\.(ts|tsx)$/)) {
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
    console.log("\n=== TYPE IMPORT FIX REPORT ===\n");
    console.log(`📊 TypeScript files processed: ${this.filesProcessed}`);
    console.log(`✅ Files with type imports fixed: ${this.fixedCount}`);

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${this.errors.length}`);
      this.errors.forEach(({ file, error }) => {
        console.log(`  • ${file}: ${error}`);
      });
    }

    console.log("\n📝 Note: Many type imports may need manual resolution:");
    console.log("  • Custom project types need proper import paths");
    console.log("  • Some types may be globally available via tsconfig");
    console.log("  • WebGPU types may need @webgpu/types package installation");
  }
}

// Main execution
console.log("🔧 Starting type import fixes...\n");

const fixer = new TypeImportFixer();

// Process main directories
console.log("Processing TypeScript files...");
fixer.scanDirectory("/home/weningerii/vtt/apps");
fixer.scanDirectory("/home/weningerii/vtt/packages");
fixer.scanDirectory("/home/weningerii/vtt/services");

// Generate report
fixer.report();
