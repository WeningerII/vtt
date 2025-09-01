import React, { createContext, useContext, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';

interface I18nContextType {
  currentLanguage: string;
  supportedLanguages: string[];
  changeLanguage: (language: string) => Promise<void>;
  isLanguageLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [isLanguageLoading, setIsLanguageLoading] = useState(false);

  const supportedLanguages = ['en', 'es', 'fr', 'de'];

  const changeLanguage = async (language: string) => {
    if (!supportedLanguages.includes(language)) {
      console.warn(`Unsupported language: ${language}. Falling back to English.`);
      language = 'en';
    }

    setIsLanguageLoading(true);
    try {
      await i18n.changeLanguage(language);
      setCurrentLanguage(language);
      // Persist language preference
      localStorage.setItem('vtt-language', language);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLanguageLoading(false);
    }
  };

  // Load saved language preference on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('vtt-language');
    if (savedLanguage && supportedLanguages.includes(savedLanguage)) {
      changeLanguage(savedLanguage);
    }
  }, []);

  // Listen to i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  const contextValue: I18nContextType = {
    currentLanguage,
    supportedLanguages,
    changeLanguage,
    isLanguageLoading,
  };

  return (
    <I18nextProvider i18n={i18n}>
      <I18nContext.Provider value={contextValue}>
        {children}
      </I18nContext.Provider>
    </I18nextProvider>
  );
}

export function useI18nContext() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}
