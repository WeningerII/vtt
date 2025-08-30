#!/usr/bin/env node

/**
 * Script to refactor console.log statements to use structured logging
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to replace
const replacements = [
  {
    // console.log -> logger.info
    pattern: /console\.log\((.*?)\);/g,
    replacement: 'logger.info($1);',
  },
  {
    // console.error -> logger.error
    pattern: /console\.error\((.*?)\);/g,
    replacement: 'logger.error($1);',
  },
  {
    // console.warn -> logger.warn
    pattern: /console\.warn\((.*?)\);/g,
    replacement: 'logger.warn($1);',
  },
  {
    // console.debug -> logger.debug
    pattern: /console\.debug\((.*?)\);/g,
    replacement: 'logger.debug($1);',
  },
  {
    // console.trace -> logger.trace
    pattern: /console\.trace\((.*?)\);/g,
    replacement: 'logger.trace($1);',
  },
];

// Import statement to add
const loggerImport = "import { logger } from '@vtt/logging';\n";

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let hasConsoleUsage = false;

  // Check if file uses console
  if (content.includes('console.')) {
    hasConsoleUsage = true;
  }

  // Apply replacements
  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  // Add import if needed and not already present
  if (modified && !content.includes('@vtt/logging')) {
    // Add import after existing imports or at the beginning
    if (content.includes('import ')) {
      const firstImportIndex = content.indexOf('import ');
      const lineEnd = content.indexOf('\n', firstImportIndex);
      content = content.slice(0, lineEnd + 1) + loggerImport + content.slice(lineEnd + 1);
    } else {
      content = loggerImport + '\n' + content;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Refactored: ${filePath}`);
    return true;
  }

  return false;
}

function findAndRefactorFiles() {
  const patterns = [
    'packages/*/src/**/*.ts',
    'packages/*/src/**/*.tsx',
    'apps/*/src/**/*.ts',
    'apps/*/src/**/*.tsx',
    'services/*/src/**/*.ts',
  ];

  let totalFiles = 0;
  let refactoredFiles = 0;

  patterns.forEach(pattern => {
    const files = glob.sync(path.join(__dirname, '..', pattern));
    
    files.forEach(file => {
      // Skip test files and type definitions
      if (file.includes('.test.') || file.includes('.spec.') || file.endsWith('.d.ts')) {
        return;
      }

      totalFiles++;
      if (refactorFile(file)) {
        refactoredFiles++;
      }
    });
  });

  console.log(`\n📊 Refactoring complete:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files refactored: ${refactoredFiles}`);
}

// Error handling improvements
function addErrorHandling() {
  const errorHandlingTemplate = `
// Enhanced error handling
export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler
export function handleError(error: Error | ApplicationError): void {
  if (error instanceof ApplicationError && error.isOperational) {
    logger.error('Operational error occurred', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
  } else {
    logger.fatal('Unexpected error occurred', {
      message: error.message,
      stack: error.stack,
    });
    // Crash the process for non-operational errors
    process.exit(1);
  }
}

// Async error wrapper
export function asyncHandler<T>(
  fn: (...args: any[]) => Promise<T>
): (...args: any[]) => Promise<T> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error as Error);
      throw error;
    }
  };
}
`;

  const errorHandlerPath = path.join(__dirname, '..', 'packages', 'core', 'src', 'errors.ts');
  
  // Create directory if it doesn't exist
  const dir = path.dirname(errorHandlerPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(errorHandlerPath, errorHandlingTemplate);
  console.log('✅ Created error handling utilities');
}

// Type safety improvements
function createTypeSafetyUtils() {
  const typeSafetyTemplate = `
/**
 * Type safety utilities
 */

// Type guard for checking if value is defined
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Type guard for checking if value is a string
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Type guard for checking if value is a number
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

// Type guard for checking if value is an object
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Type guard for checking if value is an array
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// Safe JSON parse with type validation
export function safeJsonParse<T>(
  json: string,
  validator?: (data: unknown) => data is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    if (validator && !validator(parsed)) {
      logger.warn('JSON parse validation failed', { json });
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error('JSON parse error', { error, json });
    return null;
  }
}

// Safe property access
export function getProperty<T, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined {
  return obj?.[key] ?? defaultValue;
}

// Exhaustive check for discriminated unions
export function exhaustiveCheck(value: never): never {
  throw new Error(\`Unhandled discriminated union member: \${JSON.stringify(value)}\`);
}

// Result type for error handling without exceptions
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Async result wrapper
export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(error as Error);
  }
}
`;

  const typeSafetyPath = path.join(__dirname, '..', 'packages', 'core', 'src', 'type-safety.ts');
  
  // Create directory if it doesn't exist
  const dir = path.dirname(typeSafetyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(typeSafetyPath, typeSafetyTemplate);
  console.log('✅ Created type safety utilities');
}

// Main execution
console.log('🔄 Starting logging refactoring...\n');

// Check if glob is installed
try {
  require.resolve('glob');
} catch (e) {
  console.log('Installing glob dependency...');
  require('child_process').execSync('pnpm add -D glob', { stdio: 'inherit' });
}

findAndRefactorFiles();
addErrorHandling();
createTypeSafetyUtils();

console.log('\n✨ Refactoring complete!');
console.log('Remember to:');
console.log('1. Run tests to ensure nothing broke');
console.log('2. Update package.json files to include @vtt/logging dependency');
console.log('3. Configure logger in application entry points');
