import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import en from '../i18n/en.json';
import hi from '../i18n/hi.json';

export type AppLanguage = 'en' | 'hi';

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

const LANGUAGE_STORAGE_KEY = 'app.language';
const TRANSLATIONS: Record<AppLanguage, any> = { en, hi };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getNestedValue = (obj: any, key: string): any =>
  key.split('.').reduce((acc: any, part: string) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const saved = await storage.getItem(LANGUAGE_STORAGE_KEY);
      if (mounted && (saved === 'en' || saved === 'hi')) {
        setLanguageState(saved);
      }
      if (mounted) setIsReady(true);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    setLanguageState(lang);
    await storage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  const toggleLanguage = useCallback(async () => {
    const next = language === 'en' ? 'hi' : 'en';
    await setLanguage(next);
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const primary = getNestedValue(TRANSLATIONS[language], key);
      if (typeof primary === 'string') return primary;

      const englishFallback = getNestedValue(TRANSLATIONS.en, key);
      if (typeof englishFallback === 'string') return englishFallback;

      return fallback ?? key;
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t]
  );

  if (!isReady) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
