/**
 * Jest Configuration for Low-Memory Environments
 * Use this config when running on resource-constrained systems
 */

module.exports = {
  // Test environment
  testEnvironment: "node",

  // Root directory for tests
  rootDir: ".",

  // Test file patterns
  testMatch: [
    "<rootDir>/packages/**/*.test.ts",
    "<rootDir>/packages/**/*.test.tsx",
    "<rootDir>/packages/**/*.spec.ts",
    "<rootDir>/apps/**/*.test.ts",
    "<rootDir>/apps/**/*.test.tsx",
    "<rootDir>/apps/**/*.spec.ts",
    "<rootDir>/services/**/*.test.ts",
    "<rootDir>/services/**/*.spec.ts",
  ],

  // File extensions to consider
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Transform files with TypeScript
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },

  // Module name mapping for path aliases
  moduleNameMapper: {
    "^@vtt/(.*)$": "<rootDir>/packages/$1/src",
    "^@apps/(.*)$": "<rootDir>/apps/$1/src",
    "^@services/(.*)$": "<rootDir>/services/$1/src",
  },

  // Single worker to minimize memory usage
  maxWorkers: 1,
  
  // Disable cache to reduce memory footprint
  cache: false,
  
  // Test timeout
  testTimeout: 15000,
  
  // Minimal reporters to reduce memory overhead
  reporters: ["default"],
  
  // Disable coverage collection by default
  collectCoverage: false,
  
  // Reduce concurrent test execution
  verbose: false,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // TypeScript configuration optimized for memory
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.base.json",
      isolatedModules: true,
    },
  },
};
