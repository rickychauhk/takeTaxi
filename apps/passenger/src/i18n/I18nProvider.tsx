import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadStoredAppLocale, saveAppLocale } from '../storage/appLocaleStorage';
import {
  getAppLocale,
  refreshAppLocaleFromDevice,
  setAppLocale,
  t as translate,
  type AppLocale,
  type TranslationKey,
} from './index';

export type LanguageMode = 'system' | AppLocale;

type I18nContextValue = {
  locale: AppLocale;
  languageMode: LanguageMode;
  setLanguageMode: (mode: LanguageMode) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  pickupTag: string;
  dropoffTag: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [languageMode, setLanguageModeState] = useState<LanguageMode>('system');
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    refreshAppLocaleFromDevice();
    return getAppLocale();
  });
  useEffect(() => {
    void loadStoredAppLocale().then((stored) => {
      if (!stored) return;
      setLanguageModeState(stored);
      setAppLocale(stored);
      setLocaleState(stored);
    });
  }, []);

  useEffect(() => {
    setAppLocale(locale);
  }, [locale]);

  const setLanguageMode = useCallback(async (mode: LanguageMode) => {
    setLanguageModeState(mode);
    if (mode === 'system') {
      await saveAppLocale('system');
      refreshAppLocaleFromDevice();
      setLocaleState(getAppLocale());
      return;
    }
    await saveAppLocale(mode);
    setAppLocale(mode);
    setLocaleState(mode);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: TranslationKey, params?: Record<string, string>) => translate(key, params);
    return {
      locale,
      languageMode,
      setLanguageMode,
      t,
      pickupTag: t('home.pickupTag'),
      dropoffTag: t('home.dropoffTag'),
    };
  }, [locale, languageMode, setLanguageMode]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
