/**
 * i18n configuration for the client app
 */

import { i18n, es } from "@vtt/i18n";

// Load translations
i18n.loadTranslations("es", es);

// Initialize from browser settings
if (typeof window !== "undefined") {
  i18n.initializeFromBrowser();
}

export { i18n };
