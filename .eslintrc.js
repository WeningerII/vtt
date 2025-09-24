module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    "@typescript-eslint",
    "react",
    "react-hooks",
    "import"
  ],
  settings: {
    react: {
      version: "detect",
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: [
          "./tsconfig.json",
          "./apps/*/tsconfig.json",
          "./packages/*/tsconfig.json",
          "./services/*/tsconfig.json"
        ],
      },
    },
  },
  ignorePatterns: [
    "**/dist/**",
    "**/build/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/node_modules/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "e2e/**",
    "tests/**",
    "infra/**",
    "aws/**",
    "assets/**",
    "docs/**",
    "scripts/**",
  ],
  rules: {
    // Basic ESLint rules
    "no-unused-vars": "off", // Use TS rule instead
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-debugger": "error",
    "no-duplicate-imports": "error",
    "no-undef": "off", // TypeScript handles this
    "no-empty": ["error", { allowEmptyCatch: true }],
    "prefer-const": "error",
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "curly": ["error", "all"],
    "object-shorthand": "error",
    "prefer-template": "error",
    "no-var": "error",
    "prefer-arrow-callback": "error",
  },
  overrides: [
    {
      // Test files
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      env: {
        jest: true,
      },
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
    {
      // Configuration files
      files: ["*.js", "*.config.js", ".eslintrc.js"],
      env: {
        node: true,
      },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    {
      // Server-side files
      files: ["apps/server/**/*"],
      rules: {
        "no-console": "off", // Allow console in server
        "@typescript-eslint/no-explicit-any": "warn", // More lenient for server APIs
      },
    },
    {
      // Client-side files
      files: ["apps/client/**/*"],
      env: {
        browser: true,
      },
      rules: {
        "no-console": ["error", { allow: ["warn", "error"] }],
      },
    },
    {
      // Type declaration files
      files: ["**/*.d.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-function-type": "off",
      },
    },
    {
      // Libraries: relax explicit any so it doesn't block CI while types are improved
      files: ["packages/**/*", "services/**/*"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};
