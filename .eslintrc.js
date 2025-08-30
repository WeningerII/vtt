module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  extends: ["eslint:recommended", "plugin:react-hooks/recommended"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "react-hooks"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^" }],
    "no-console": "off",
    "no-undef": "off", // TypeScript handles this
    "@typescript-eslint/no-explicit-any": "off",
    "no-empty": ["warn", { allowEmptyCatch: true }],
    "react-hooks/exhaustive-deps": "warn",
  },
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        "no-undef": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^" }],
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};
