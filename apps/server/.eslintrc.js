module.exports = {
  extends: '../../.eslintrc.js',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
        moduleDirectory: ['node_modules', '../../node_modules'],
      },
    },
  },
  overrides: [
    {
      // Configuration files
      files: ['*.js', '*.config.js', '.eslintrc.js'],
      parserOptions: {
        project: null,
      },
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      // Files excluded from tsconfig.json
      files: [
        '**/*.test.ts',
        '**/*.spec.ts', 
        'src/test-runner.ts',
        'src/test/**/*',
        'src/**/__tests__/**/*'
      ],
      parserOptions: {
        project: null, // Don't use TypeScript project for excluded files
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      }
    }
  ],
  rules: {
    // Server-specific rules
    'no-console': 'off', // Allow console in server
    '@typescript-eslint/no-explicit-any': 'warn', // More lenient for server APIs
  },
};
