/**
 * Jest Configuration for VTT Project
 * Unified testing configuration for all packages
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
    "<rootDir>/tests/**/*.test.ts",
    "<rootDir>/tests/**/*.spec.ts",
  ],

  // File extensions to consider
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // Transform files with TypeScript
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },

  // Module name mapping for path aliases
  moduleNameMapping: {
    "^@vtt/(.*)$": "<rootDir>/packages/$1/src",
    "^@apps/(.*)$": "<rootDir>/apps/$1/src",
    "^@services/(.*)$": "<rootDir>/services/$1/src",
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "html", "json"],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Files to include in coverage
  collectCoverageFrom: [
    "packages/**/*.ts",
    "apps/**/*.ts",
    "services/**/*.ts",
    "!**/__tests__/**",
    "!**/*.test.ts",
    "!**/*.spec.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/build/**",
  ],

  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,

  // Concurrent test execution
  maxWorkers: "50%",

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for debugging
  verbose: false,

  // Projects for different test types
  projects: [
    {
      displayName: "unit",
      testMatch: [
        "<rootDir>/packages/**/*.test.ts",
        "<rootDir>/packages/**/*.test.tsx",
        "<rootDir>/packages/**/*.spec.ts"
      ],
      testEnvironment: "node",
    },
    {
      displayName: "integration",
      testMatch: [
        "<rootDir>/apps/**/*.test.ts",
        "<rootDir>/apps/**/*.test.tsx",
        "<rootDir>/apps/**/*.spec.ts"
      ],
      testEnvironment: "node",
      testTimeout: 60000,
    },
    {
      displayName: "services",
      testMatch: [
        "<rootDir>/services/**/*.test.ts",
        "<rootDir>/services/**/*.spec.ts"
      ],
      testEnvironment: "node",
      testTimeout: 45000,
    },
  ],

  // Global setup and teardown
  globalSetup: "<rootDir>/jest.global-setup.js",
  globalTeardown: "<rootDir>/jest.global-teardown.js",

  // Test reporter configuration
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "<rootDir>/test-results",
        outputName: "results.xml",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
        ancestorSeparator: " › ",
        usePathForSuiteName: true,
      },
    ],
    [
      "jest-html-reporters",
      {
        publicPath: "<rootDir>/test-results",
        filename: "report.html",
        expand: true,
      },
    ],
  ],

  // Mock configuration
  modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/build/"],

  // Snapshot configuration
  snapshotSerializers: ["jest-serializer-path"],

  // Watch mode configuration
  watchPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/dist/",
    "<rootDir>/build/",
    "<rootDir>/coverage/",
  ],

  // Error handling
  errorOnDeprecated: true,

  // Performance optimization
  cache: true,
  cacheDirectory: "<rootDir>/.jest-cache",

  // TypeScript configuration
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.base.json",
      isolatedModules: true,
    },
  },
};
