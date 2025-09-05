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
    "@typescript-eslint"
  ],
  settings: {
    react: {
      version: "detect",
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ["./tsconfig.json", "./apps/*/tsconfig.json", "./packages/*/tsconfig.json"],
      },
    },
  },
  rules: {
    // Basic ESLint rules
    "no-unused-vars": "off", // Handled by TypeScript
    "no-console": "off", // Allow console for now to reduce noise
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
  ],
};
