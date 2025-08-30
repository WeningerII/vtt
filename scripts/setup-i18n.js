#!/usr/bin/env node

/**
 * Script to set up internationalization in the client app
 */

const fs = require("fs");
const path = require("path");

// Update App.tsx to include I18nProvider
function updateAppComponent() {
  const appPath = path.join(__dirname, "../apps/client/src/App.tsx");

  if (!fs.existsSync(appPath)) {
    console.log("App.tsx not found, skipping...");
    return;
  }

  let content = fs.readFileSync(appPath, "utf8");

  // Check if already has I18nProvider
  if (content.includes("I18nProvider")) {
    console.log("✓ App.tsx already has I18nProvider");
    return;
  }

  // Add import
  const importStatement = "import { I18nProvider } from '@vtt/i18n';\n";
  const lastImportIndex = content.lastIndexOf("import ");
  const endOfLastImport = content.indexOf("\n", lastImportIndex) + 1;

  content = content.slice(0, endOfLastImport) + importStatement + content.slice(endOfLastImport);

  // Wrap App content with I18nProvider
  const appReturnMatch = content.match(/return\s*\(/);
  if (appReturnMatch) {
    const returnIndex = appReturnMatch.index + appReturnMatch[0].length;
    content =
      content.slice(0, returnIndex) + "\n    <I18nProvider>\n      " + content.slice(returnIndex);

    // Find the closing of return statement and add closing tag
    let depth = 1;
    let i = returnIndex;
    while (depth > 0 && i < content.length) {
      if (content[i] === "(") depth++;
      if (content[i] === ")") depth--;
      i++;
    }
    content = content.slice(0, i - 1) + "\n    </I18nProvider>\n  " + content.slice(i - 1);
  }

  fs.writeFileSync(appPath, content);
  console.log("✓ Updated App.tsx with I18nProvider");
}

// Add language selector to header/navigation
function addLanguageSelector() {
  const headerPaths = [
    path.join(__dirname, "../apps/client/src/components/Header.tsx"),
    path.join(__dirname, "../apps/client/src/components/Navigation.tsx"),
    path.join(__dirname, "../apps/client/src/components/NavBar.tsx"),
  ];

  for (const headerPath of headerPaths) {
    if (fs.existsSync(headerPath)) {
      let content = fs.readFileSync(headerPath, "utf8");

      if (content.includes("LanguageSelector")) {
        console.log(`✓ ${path.basename(headerPath)} already has LanguageSelector`);
        continue;
      }

      // Add import
      const importStatement = "import { LanguageSelector } from '@vtt/i18n';\n";
      const lastImportIndex = content.lastIndexOf("import ");
      if (lastImportIndex !== -1) {
        const endOfLastImport = content.indexOf("\n", lastImportIndex) + 1;
        content =
          content.slice(0, endOfLastImport) + importStatement + content.slice(endOfLastImport);
      }

      // Add LanguageSelector component (simple insertion before closing tag)
      const navEndMatch = content.match(/<\/nav>|<\/header>|<\/div>/);
      if (navEndMatch) {
        const insertIndex = navEndMatch.index;
        content =
          content.slice(0, insertIndex) +
          "        <LanguageSelector />\n" +
          content.slice(insertIndex);
      }

      fs.writeFileSync(headerPath, content);
      console.log(`✓ Added LanguageSelector to ${path.basename(headerPath)}`);
      break; // Only update the first found component
    }
  }
}

// Update sample components to use translations
function updateComponentsWithTranslations() {
  const componentsDir = path.join(__dirname, "../apps/client/src/components");
  const pagesDir = path.join(__dirname, "../apps/client/src/pages");

  const filesToUpdate = [
    path.join(pagesDir, "LoginPage.tsx"),
    path.join(pagesDir, "RegisterPage.tsx"),
    path.join(pagesDir, "Dashboard.tsx"),
  ];

  for (const filePath of filesToUpdate) {
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf8");

    // Skip if already using translations
    if (content.includes("useTranslation") || content.includes("useI18n")) {
      console.log(`✓ ${path.basename(filePath)} already uses translations`);
      continue;
    }

    // Add import
    const importStatement = "import { useTranslation } from '@vtt/i18n';\n";
    const lastImportIndex = content.lastIndexOf("import ");
    if (lastImportIndex !== -1) {
      const endOfLastImport = content.indexOf("\n", lastImportIndex) + 1;
      content =
        content.slice(0, endOfLastImport) + importStatement + content.slice(endOfLastImport);
    }

    // Add hook usage (after the component declaration)
    const componentMatch = content.match(/(?:function|const)\s+\w+.*?\{/);
    if (componentMatch) {
      const insertIndex = componentMatch.index + componentMatch[0].length;
      content =
        content.slice(0, insertIndex) +
        "\n  const { t } = useTranslation();\n" +
        content.slice(insertIndex);
    }

    // Replace some hardcoded strings with translations
    const replacements = [
      { from: "'Login'", to: "t('auth.login')" },
      { from: '"Login"', to: "t('auth.login')" },
      { from: "'Register'", to: "t('auth.register')" },
      { from: '"Register"', to: "t('auth.register')" },
      { from: "'Email'", to: "t('auth.email')" },
      { from: '"Email"', to: "t('auth.email')" },
      { from: "'Password'", to: "t('auth.password')" },
      { from: '"Password"', to: "t('auth.password')" },
      { from: "'Dashboard'", to: "t('navigation.dashboard')" },
      { from: '"Dashboard"', to: "t('navigation.dashboard')" },
    ];

    for (const { from, to } of replacements) {
      // Only replace in JSX context (rough heuristic)
      const jsxPattern = new RegExp(`(>\\s*)${from}(\\s*<)`, "g");
      content = content.replace(jsxPattern, `$1{${to}}$2`);
    }

    fs.writeFileSync(filePath, content);
    console.log(`✓ Updated ${path.basename(filePath)} with translations`);
  }
}

// Create i18n config file
function createI18nConfig() {
  const configPath = path.join(__dirname, "../apps/client/src/i18n.config.ts");

  if (fs.existsSync(configPath)) {
    console.log("✓ i18n.config.ts already exists");
    return;
  }

  const configContent = `/**
 * i18n configuration for the client app
 */

import { i18n } from '@vtt/i18n';
import { es } from '@vtt/i18n/src/translations/es';

// Load translations
i18n.loadTranslations('es', es);

// Initialize from browser settings
if (typeof window !== 'undefined') {
  i18n.initializeFromBrowser();
}

export { i18n };
`;

  fs.writeFileSync(configPath, configContent);
  console.log("✓ Created i18n.config.ts");
}

// Main execution
console.log("Setting up internationalization...\n");

updateAppComponent();
addLanguageSelector();
updateComponentsWithTranslations();
createI18nConfig();

console.log("\n✅ Internationalization setup complete!");
console.log("\nNext steps:");
console.log("1. Add more translations to the translation files");
console.log("2. Update remaining components to use translations");
console.log("3. Test language switching in the app");
console.log("4. Consider adding RTL support for Arabic/Hebrew");
