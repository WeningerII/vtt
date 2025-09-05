import React, { createContext, useContext, useState } from 'react';

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
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLanguageLoading, setIsLanguageLoading] = useState(false);

  const supportedLanguages = ['en', 'es', 'fr', 'de'];

  const changeLanguage = async (language: string) => {
    if (!supportedLanguages.includes(language)) {
      console.warn(`Unsupported language: ${language}. Falling back to English.`);
      language = 'en';
    }

    setIsLanguageLoading(true);
    try {
      setCurrentLanguage(language);
      localStorage.setItem('vtt-language', language);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsLanguageLoading(false);
    }
  };

  const contextValue: I18nContextType = {
    currentLanguage,
    supportedLanguages,
    changeLanguage,
    isLanguageLoading,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18nContext() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}
