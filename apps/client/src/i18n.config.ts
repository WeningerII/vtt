/**
 * i18n configuration for the client app
 */

// import { i18n, es } from "@vtt/i18n";
// TODO: Implement i18n integration - using stub for now
const i18n = { 
  loadTranslations: (_locale: string, _translations: any) => {},
  initializeFromBrowser: () => {}
};
const es = {};

// Load translations
i18n.loadTranslations("es", es);

// Initialize from browser settings
if (typeof window !== "undefined") {
  i18n.initializeFromBrowser();
}

export { i18n };
