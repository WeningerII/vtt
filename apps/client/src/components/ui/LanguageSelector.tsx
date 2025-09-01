import React from 'react';
import { Globe } from 'lucide-react';
import { useI18nContext } from '../../providers/I18nProvider';
import { useTranslation } from '../../hooks/useTranslation';

interface LanguageSelectorProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSelector({ className = '', compact = false }: LanguageSelectorProps) {
  const { currentLanguage, supportedLanguages, changeLanguage, isLanguageLoading } = useI18nContext();
  const { getLanguageName } = useTranslation();

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    changeLanguage(event.target.value);
  };

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {!compact && <Globe className="h-4 w-4 text-neutral-500" />}
      <select
        value={currentLanguage}
        onChange={handleLanguageChange}
        disabled={isLanguageLoading}
        className={`
          bg-transparent border border-neutral-300 rounded px-2 py-1 text-sm
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${compact ? 'min-w-0' : 'min-w-[100px]'}
        `}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {compact ? lang.toUpperCase() : getLanguageName(lang)}
          </option>
        ))}
      </select>
    </div>
  );
}
