/**
 * Internationalization (i18n) Package for VTT
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文'
} as const;

export type Language = keyof typeof SUPPORTED_LANGUAGES;

// Translation dictionary type
export type TranslationDictionary = {
  [key: string]: string | TranslationDictionary;
};

// Translations storage
const translations: Record<Language, TranslationDictionary> = {
  en: {},
  es: {},
  fr: {},
  de: {},
  ja: {},
  zh: {}
};

/**
 * I18n Manager Class
 */
export class I18nManager {
  private currentLanguage: Language = 'en';
  private fallbackLanguage: Language = 'en';
  private listeners: Set<(lang: Language) => void> = new Set();

  /**
   * Get current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Set current language
   */
  setLanguage(language: Language): void {
    if (this.currentLanguage !== language) {
      this.currentLanguage = language;
      this.notifyListeners();
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('vtt-language', language);
      }
    }
  }

  /**
   * Load translations for a language
   */
  loadTranslations(language: Language, dictionary: TranslationDictionary): void {
    translations[language] = { ...translations[language], ...dictionary };
  }

  /**
   * Get translation for a key
   */
  translate(key: string, params?: Record<string, any>): string {
    const translation = this.getTranslationValue(key, this.currentLanguage) ||
                       this.getTranslationValue(key, this.fallbackLanguage) ||
                       key;

    // Replace parameters
    if (params) {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  /**
   * Alias for translate
   */
  t = this.translate.bind(this);

  /**
   * Get nested translation value
   */
  private getTranslationValue(key: string, language: Language): string | undefined {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Interpolate parameters in translation
   */
  private interpolate(text: string, params: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * Format number based on locale
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.getLocale(), options).format(value);
  }

  /**
   * Format date based on locale
   */
  formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(this.getLocale(), options).format(d);
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat(this.getLocale(), {
      style: 'currency',
      currency
    }).format(amount);
  }

  /**
   * Get locale string for current language
   */
  private getLocale(): string {
    const localeMap: Record<Language, string> = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      ja: 'ja-JP',
      zh: 'zh-CN'
    };
    return localeMap[this.currentLanguage];
  }

  /**
   * Subscribe to language changes
   */
  subscribe(listener: (lang: Language) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of language change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentLanguage));
  }

  /**
   * Initialize from browser settings
   */
  initializeFromBrowser(): void {
    if (typeof window === 'undefined') return;

    // Check localStorage first
    const savedLang = localStorage.getItem('vtt-language') as Language;
    if (savedLang && savedLang in SUPPORTED_LANGUAGES) {
      this.setLanguage(savedLang);
      return;
    }

    // Check browser language
    const browserLang = navigator.language.split('-')[0] as Language;
    if (browserLang in SUPPORTED_LANGUAGES) {
      this.setLanguage(browserLang);
    }
  }
}

// Singleton instance
export const i18n = new I18nManager();

/**
 * React Context for i18n
 */
const I18nContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
}>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  formatNumber: (value) => String(value),
  formatDate: (date) => String(date),
  formatCurrency: (amount) => String(amount)
});

/**
 * I18n Provider Component
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(i18n.getLanguage());

  useEffect(() => {
    // Initialize from browser
    i18n.initializeFromBrowser();
    setLanguageState(i18n.getLanguage());

    // Subscribe to language changes
    return i18n.subscribe((lang) => {
      setLanguageState(lang);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    i18n.setLanguage(lang);
  };

  const value = {
    language,
    setLanguage,
    t: i18n.t,
    formatNumber: i18n.formatNumber.bind(i18n),
    formatDate: i18n.formatDate.bind(i18n),
    formatCurrency: i18n.formatCurrency.bind(i18n)
  };

  return React.createElement(
    I18nContext.Provider,
    { value },
    children
  );
}

/**
 * Hook to use i18n
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

/**
 * Hook for translations
 */
export function useTranslation() {
  const { t } = useI18n();
  return { t };
}

/**
 * Load default English translations
 */
i18n.loadTranslations('en', {
  common: {
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning'
  },
  auth: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    rememberMe: 'Remember Me',
    loginSuccess: 'Login successful',
    loginError: 'Invalid email or password',
    registerSuccess: 'Registration successful',
    registerError: 'Registration failed'
  },
  navigation: {
    home: 'Home',
    dashboard: 'Dashboard',
    gameSession: 'Game Session',
    characters: 'Characters',
    campaigns: 'Campaigns',
    settings: 'Settings',
    profile: 'Profile',
    help: 'Help'
  },
  game: {
    createCharacter: 'Create Character',
    editCharacter: 'Edit Character',
    characterName: 'Character Name',
    characterClass: 'Class',
    characterLevel: 'Level',
    hitPoints: 'Hit Points',
    armorClass: 'Armor Class',
    initiative: 'Initiative',
    rollDice: 'Roll Dice',
    endTurn: 'End Turn',
    startCombat: 'Start Combat',
    endCombat: 'End Combat'
  },
  messages: {
    welcome: 'Welcome, {{name}}!',
    itemsCount: 'You have {{count}} item(s)',
    confirmDelete: 'Are you sure you want to delete {{item}}?',
    saveSuccess: '{{item}} saved successfully',
    saveError: 'Failed to save {{item}}',
    networkError: 'Network error. Please try again.'
  },
  validation: {
    required: 'This field is required',
    email: 'Please enter a valid email',
    minLength: 'Must be at least {{min}} characters',
    maxLength: 'Must be no more than {{max}} characters',
    passwordMatch: 'Passwords do not match',
    invalidFormat: 'Invalid format'
  }
});

/**
 * Language selector component
 */
export function LanguageSelector() {
  const { language, setLanguage } = useI18n();

  return React.createElement(
    'select',
    {
      value: language,
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value as Language),
      'aria-label': 'Select language'
    },
    Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) =>
      React.createElement('option', { key: code, value: code }, name)
    )
  );
}

/**
 * Utility to extract translatable strings from code
 */
export function extractTranslatableStrings(code: string): string[] {
  const patterns = [
    /t\(['"`]([^'"`]+)['"`]\)/g,
    /i18n\.t\(['"`]([^'"`]+)['"`]\)/g,
    /translate\(['"`]([^'"`]+)['"`]\)/g
  ];

  const strings = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      strings.add(match[1]);
    }
  }

  return Array.from(strings);
}

// Re-export available translation dictionaries for consumers
export { es } from './translations/es';
