import { useTranslation as useReactI18next } from 'react-i18next';

// Type-safe translation hook with key suggestions
export function useTranslation() {
  const { t, i18n } = useReactI18next();

  // Enhanced translation function with better type safety
  const translate = (key: string, options?: any): string => {
    return t(key, options) as string;
  };

  // Language switching utilities
  const changeLanguage = (lng: string) => {
    return i18n.changeLanguage(lng);
  };

  const getCurrentLanguage = () => {
    return i18n.language;
  };

  const getSupportedLanguages = () => {
    return ['en', 'es', 'fr', 'de'];
  };

  const getLanguageName = (code: string): string => {
    const names: Record<string, string> = {
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
    };
    return names[code] || code;
  };

  return {
    t: translate,
    i18n,
    changeLanguage,
    getCurrentLanguage,
    getSupportedLanguages,
    getLanguageName,
  };
}

// Specialized hooks for common patterns
export function useAuthTranslation() {
  const { t } = useTranslation();
  return {
    t: (key: string, options?: any): string => t(`auth.${key}`, options),
  };
}

export function useVTTTranslation() {
  const { t } = useTranslation();
  return {
    t: (key: string, options?: any): string => t(`vtt.${key}`, options),
  };
}

export function useCommonTranslation() {
  const { t } = useTranslation();
  return {
    t: (key: string, options?: any): string => t(`common.${key}`, options),
  };
}

export function useErrorTranslation() {
  const { t } = useTranslation();
  return {
    t: (key: string, options?: any): string => t(`errors.${key}`, options),
  };
}
