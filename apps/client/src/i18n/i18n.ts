import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    // Namespace configuration
    defaultNS: 'translation',
    ns: ['translation'],

    // Key separator and nesting
    keySeparator: '.',
    nsSeparator: ':',

    // Missing key handling
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lng, ns, key) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation: ${lng}:${ns}:${key}`);
      }
    },

    // Pluralization
    pluralSeparator: '_',
    contextSeparator: '_',

    // React specific options
    react: {
      useSuspense: false,
    },
  });

export default i18n;
