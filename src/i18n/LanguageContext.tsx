import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  SupportedLanguage,
  TranslationDictionary,
  translations,
} from './translations';

interface LanguageContextValue {
  lang: SupportedLanguage;
  setLang: (next: SupportedLanguage) => void;
  t: TranslationDictionary;
}

const STORAGE_KEY = 'tenderlink_lang';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'am') {
      return saved;
    }
  } catch {
    // Ignore storage access errors in private browsing
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SupportedLanguage>(getInitialLanguage);

  const setLang = (next: SupportedLanguage) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translations[lang].meta.pageTitle;
  }, [lang]);

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t: translations[lang],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
